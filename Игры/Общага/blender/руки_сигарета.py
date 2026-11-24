# Сборка рук от первого лица, пачки Marlboro, сигареты и газовой зажигалки на РЕАЛЬНОМ CC0-риге
# PSX First Person Arms (assets/arms_rig.blend) с полным скелетом (52 кости + IK) и 8 NLA-анимациями.
#
# Запуск из корня проекта:
#   blender --background --python blender/руки_сигарета.py
#
# Результат: models/руки_сигарета.glb (готово для Godot 4.7 + scripts/smoking_fp.gd).

import bpy
import math
import os
from mathutils import Euler, Matrix, Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_DIR = os.path.join(ROOT, "assets", "smoking_fp")
TEX_DIR = os.path.join(ROOT, "textures")
OUT_GLB = os.path.join(ROOT, "models", "руки_сигарета.glb")

ARMS_BLEND = os.path.join(ASSETS_DIR, "arms_rig.blend")
ARMS_SKIN_TEX = os.path.join(ASSETS_DIR, "arms_01.png")
PACK_GLB = os.path.join(ASSETS_DIR, "marlboro_cigarette_pack_ps1__low_poly.glb")
LIGHTER_GLB = os.path.join(ASSETS_DIR, "gas_cigarette_lighter.glb")


def smooth(ob):
    if ob.type == "MESH":
        for p in ob.data.polygons:
            p.use_smooth = True


def make_mat(name, color, rough=0.7, metallic=0.0, emit=None, emit_strength=0.0, tex_file=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    if tex_file and os.path.exists(os.path.join(TEX_DIR, tex_file)):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(os.path.join(TEX_DIR, tex_file), check_existing=True)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return m


def find_armature():
    for ob in bpy.data.objects:
        if ob.type == "ARMATURE":
            return ob
    raise RuntimeError("В arms_rig.blend не найден Armature!")


def clear_demo_animations(armature):
    for ob in bpy.data.objects:
        if ob.animation_data:
            ob.animation_data_clear()
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act, do_unlink=True)
    for ob in list(bpy.data.objects):
        if ob.type in {"CAMERA", "LIGHT"} or (ob.type == "MESH" and ob.find_armature() != armature):
            bpy.data.objects.remove(ob, do_unlink=True)


def apply_bare_skin_texture():
    """Убеждается, что на меше рук подключена текстура кожи arms_01.png (без перчаток)."""
    if not os.path.exists(ARMS_SKIN_TEX):
        return
    img = bpy.data.images.load(ARMS_SKIN_TEX, check_existing=True)
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == "TEX_IMAGE":
                node.image = img


def import_and_normalize_glb(filepath, root_name, target_height_m):
    """Импортирует внешний GLB, объединяет под один Empty и масштабирует до точного размера в метрах."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    imported = [ob for ob in bpy.data.objects if ob not in before]

    root = bpy.data.objects.new(root_name, None)
    bpy.context.collection.objects.link(root)

    # Вычисляем общий bounding box импортированных мешей
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    for ob in imported:
        if ob.type == "MESH":
            for corner in ob.bound_box:
                w = ob.matrix_world @ Vector(corner)
                mins.x, mins.y, mins.z = min(mins.x, w.x), min(mins.y, w.y), min(mins.z, w.z)
                maxs.x, maxs.y, maxs.z = max(maxs.x, w.x), max(maxs.y, w.y), max(maxs.z, w.z)

    size = maxs - mins
    max_dim = max(size.x, size.y, size.z, 1e-4)
    scale = target_height_m / max_dim
    center = (mins + maxs) * 0.5

    # Привязываем корневые объекты импорта к нашему Empty с центрированием и масштабом
    top_imported = [ob for ob in imported if ob.parent not in imported]
    for ob in top_imported:
        ob.parent = root
        ob.location = (ob.location - center) * scale
        ob.scale = ob.scale * scale

    return root, size * scale


def attach_object_to_bone_world(ob, arm_ob, bone_name, world_mat):
    """Жёстко привязывает объект к кости так, чтобы в текущей позе он занял точно world_mat."""
    bpy.context.view_layer.update()
    pb = arm_ob.pose.bones[bone_name]
    # В Blender parent_type='BONE' привязывает к TAIL кости
    bone_world = arm_ob.matrix_world @ pb.matrix
    tail_offset = Matrix.Translation((0.0, pb.bone.length, 0.0))
    parent_world = bone_world @ tail_offset
    local_mat = parent_world.inverted() @ world_mat
    ob.parent = arm_ob
    ob.parent_type = "BONE"
    ob.parent_bone = bone_name
    ob.matrix_basis = local_mat


def build_cigarette_between_fingers(arm_ob):
    """
    Создаёт сигарету и сажает её ТОЧНО между реальными костями f_index.01.R/02.R и f_middle.01.R/02.R.
    Фильтр (-Y локально) направлен к ладони/игроку, тлеющий кончик (+Y локально) — наружу.
    """
    pose_and_key_fingers(arm_ob, "R", None, "cigarette")
    bpy.context.view_layer.update()
    pb = arm_ob.pose.bones
    # Вычисляем точный центр контакта между указательным и средним пальцами в мировой СК
    p_idx = arm_ob.matrix_world @ pb["f_index.02.R"].head.lerp(pb["f_index.03.R"].head, 0.42)
    p_mid = arm_ob.matrix_world @ pb["f_middle.02.R"].head.lerp(pb["f_middle.03.R"].head, 0.42)
    grip_center = (p_idx + p_mid) * 0.5

    # Направление вдоль сигареты: перпендикулярно линии между пальцами, тлеющий конец наружу (к тыльной/боковой стороне)
    finger_dir = ((arm_ob.matrix_world @ pb["f_index.02.R"].head) - (arm_ob.matrix_world @ pb["f_index.01.R"].head)).normalized()
    between_dir = (p_idx - p_mid).normalized()
    # Вектор наружу от ладони (перекрёстное произведение)
    outward = finger_dir.cross(between_dir).normalized()
    # Проверяем, чтобы кончик сигареты смотрел слегка вперёд (-Y в СК arms_rig) и вверх (+Z)
    if outward.y > 0.2:
        outward = -outward
    side_axis = between_dir
    up_axis = outward.cross(side_axis).normalized()
    side_axis = up_axis.cross(outward).normalized()

    # Локальная ось +Y сигареты совпадает с outward (от фильтра к угольку)
    rot_mat = Matrix((side_axis, outward, up_axis)).transposed().to_4x4()
    cig_world = Matrix.Translation(grip_center) @ rot_mat

    cig = bpy.data.objects.new("сигарета", None)
    bpy.context.collection.objects.link(cig)
    attach_object_to_bone_world(cig, arm_ob, "hand.R", cig_world)

    filter_mat = make_mat("сигарета_фильтр", (0.80, 0.52, 0.24), 0.84, tex_file="сигарета_фильтр.png")
    gold_mat = make_mat("сигарета_кольцо", (0.80, 0.66, 0.34), 0.35, metallic=0.65)
    paper_mat = make_mat("сигарета_бумага", (0.94, 0.93, 0.90), 0.88, tex_file="сигарета_бумага.png")
    ash_mat = make_mat("сигарета_пепел", (0.24, 0.23, 0.23), 0.96)
    ember_mat = make_mat("сигарета_уголёк", (0.20, 0.08, 0.05), 0.78,
                         emit=(1.0, 0.30, 0.03), emit_strength=0.0)

    def add_seg(name, r1, r2, length, y0, mat):
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r1, radius2=r2, depth=length, location=(0, 0, length / 2))
        ob = bpy.context.object
        ob.name = name
        bpy.ops.object.transform_apply(location=True)
        ob.location = (0, y0, 0)
        ob.rotation_euler = (math.radians(-90), 0, 0)
        ob.data.materials.append(mat)
        smooth(ob)
        ob.parent = cig
        return ob

    filter_ob = add_seg("фильтр", 0.0040, 0.0040, 0.025, -0.025, filter_mat)
    add_seg("кольцо_фильтра", 0.00408, 0.00408, 0.0018, 0.0, gold_mat)
    add_seg("бумага", 0.0040, 0.0039, 0.052, 0.0018, paper_mat)
    add_seg("пепел", 0.0039, 0.0034, 0.0055, 0.0538, ash_mat)
    ember_ob = add_seg("уголёк", 0.0034, 0.0019, 0.0047, 0.0593, ember_mat)

    # Маркеры точных торцов фильтра и уголька для математического расчёта затяжки и поджигания
    filter_tip = bpy.data.objects.new("фильтр_торец", None)
    bpy.context.collection.objects.link(filter_tip)
    filter_tip.parent = cig
    filter_tip.location = (0.0, -0.025, 0.0)

    ember_tip = bpy.data.objects.new("уголёк_торец", None)
    bpy.context.collection.objects.link(ember_tip)
    ember_tip.parent = cig
    ember_tip.location = (0.0, 0.064, 0.0)

    return {"root": cig, "filter_tip": filter_tip, "ember_tip": ember_tip, "ember_mat": ember_mat}


def build_pack_and_lighter(arm_ob):
    """Импортирует реальную пачку Marlboro и газовую зажигалку и крепит к реальной ладони hand.L."""
    bpy.context.view_layer.update()
    pb = arm_ob.pose.bones
    p_hand_l = arm_ob.matrix_world @ pb["hand.L"].head
    p_mid_l = arm_ob.matrix_world @ pb["f_middle.01.L"].head
    palm_center_l = (p_hand_l + p_mid_l) * 0.5 + Vector((0.0, 0.0, -0.025))

    # 1. Реальная пачка Marlboro (высота 85 мм)
    pack_root, _ = import_and_normalize_glb(PACK_GLB, "пачка_узел", 0.085)
    pack_world = Matrix.Translation(palm_center_l) @ Euler((0, 0, math.radians(15)), "XYZ").to_matrix().to_4x4()
    attach_object_to_bone_world(pack_root, arm_ob, "hand.L", pack_world)

    # 2. Реальная газовая зажигалка (высота 80 мм) + двухслойное анимированное пламя на сопле
    lighter_root, lt_size = import_and_normalize_glb(LIGHTER_GLB, "зажигалка", 0.080)
    lt_world = Matrix.Translation(palm_center_l + Vector((0.0, 0.0, 0.008)))
    attach_object_to_bone_world(lighter_root, arm_ob, "hand.L", lt_world)

    flame_mat = make_mat("зажигалка_пламя", (1.0, 0.74, 0.20), 0.08, emit=(1.0, 0.46, 0.07), emit_strength=2.8)
    core_mat = make_mat("зажигалка_ядро", (0.35, 0.68, 1.0), 0.08, emit=(0.30, 0.66, 1.0), emit_strength=2.0)

    flame_root = bpy.data.objects.new("пламя_узел", None)
    bpy.context.collection.objects.link(flame_root)
    flame_root.parent = lighter_root
    flame_root.location = (0.0, 0.0, lt_size.z * 0.52)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.0068, location=(0, 0, 0.015))
    fl_out = bpy.context.object
    fl_out.name = "пламя_внешнее"
    fl_out.scale = (0.62, 0.62, 2.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    fl_out.data.materials.append(flame_mat)
    smooth(fl_out)
    fl_out.parent = flame_root

    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0034, location=(0, 0, 0.008))
    fl_in = bpy.context.object
    fl_in.name = "пламя_ядро"
    fl_in.scale = (0.60, 0.60, 1.80)
    bpy.ops.object.transform_apply(location=True, scale=True)
    fl_in.data.materials.append(core_mat)
    smooth(fl_in)
    fl_in.parent = flame_root
    flame_root.scale = (0.001, 0.001, 0.001)

    flame_tip = bpy.data.objects.new("пламя_вершина", None)
    bpy.context.collection.objects.link(flame_tip)
    flame_tip.parent = flame_root
    flame_tip.location = (0.0, 0.0, 0.026)

    return pack_root, {"root": lighter_root, "flame": flame_root, "flame_tip": flame_tip}


def set_ik_world(arm_ob, bone_name, world_pos, world_rot_deg=None):
    """Перемещает IK-кость (handIK.R / handIK.L / elbowIK.*) в точную мировую точку."""
    pb = arm_ob.pose.bones[bone_name]
    pb.rotation_mode = "XYZ"
    cur_m = arm_ob.matrix_world @ pb.matrix
    if world_rot_deg is not None:
        rm = Euler(tuple(math.radians(a) for a in world_rot_deg), "XYZ").to_matrix().to_4x4()
    else:
        rm = cur_m.to_3x3().to_4x4()
    target_w = Matrix.Translation(world_pos) @ rm
    pb.matrix = arm_ob.matrix_world.inverted() @ target_w


def key_pose_bone(arm_ob, bone_name, frame):
    pb = arm_ob.pose.bones[bone_name]
    pb.keyframe_insert(data_path="location", frame=frame)
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)


def prop_rotation(arm_ob, hand_name, point, initial, prop, target):
    """Вычисляет поворот управляющей кости для заданной ориентации предмета."""
    set_ik_world(arm_ob, hand_name, point, initial)
    bpy.context.view_layer.update()
    control = arm_ob.matrix_world @ arm_ob.pose.bones[hand_name].matrix
    delta = target @ prop.matrix_world.to_quaternion().inverted()
    return tuple(math.degrees(a) for a in (delta @ control.to_quaternion()).to_euler("XYZ"))


def cigarette_rotation(direction, roll=0):
    forward = Vector(direction).normalized()
    side = forward.cross(Vector((0, 0, 1))).normalized()
    up = side.cross(forward)
    basis = Matrix((side, forward, up)).transposed().to_quaternion()
    return basis @ Euler((0, math.radians(roll), 0)).to_quaternion()


def solve_contact(armature, controller, point, rotation, marker, target):
    for _ in range(6):
        set_ik_world(armature, controller, point, rotation)
        bpy.context.view_layer.update()
        error = target - marker.matrix_world.translation
        if error.length < 0.001:
            break
        point = point + error
    return point


def key_obj(ob, frame, scale=None):
    if scale is not None:
        ob.scale = scale
        ob.keyframe_insert(data_path="scale", frame=frame)


def pose_and_key_fingers(arm_ob, side_tag, frame, mode):
    """Задаёт естественные позы реальным костям пальцев PSX First Person Arms."""
    pb = arm_ob.pose.bones
    if mode == "cigarette":
        curls = {
            "f_index":  (25, 35, 15),
            "f_middle": (28, 36, 17),
            "f_ring":   (48, 56, 28),
            "f_pinky":  (54, 58, 32),
            "thumb":    (12, 18, 12),
        }
    elif mode == "flick":
        curls = {
            "f_index":  (32, 44, 22),
            "f_middle": (28, 36, 17),
            "f_ring":   (48, 56, 28),
            "f_pinky":  (54, 58, 32),
            "thumb":    (12, 18, 12),
        }
    elif mode == "pack":
        curls = {
            "f_index":  (22, 28, 16),
            "f_middle": (28, 34, 18),
            "f_ring":   (34, 38, 22),
            "f_pinky":  (42, 42, 24),
            "thumb":    (12, 22, 16),
        }
    elif mode == "pinch":
        curls = {
            "f_index":  (36, 40, 22),
            "f_middle": (54, 60, 36),
            "f_ring":   (68, 76, 48),
            "f_pinky":  (72, 78, 50),
            "thumb":    (30, 28, 18),
        }
    elif mode == "lighter_press":
        curls = {
            "f_index":  (66, 78, 48),
            "f_middle": (68, 80, 50),
            "f_ring":   (70, 80, 50),
            "f_pinky":  (72, 82, 52),
            "thumb":    (42, 36, 22),
        }
    else:  # lighter_ready
        curls = {
            "f_index":  (66, 78, 48),
            "f_middle": (68, 80, 50),
            "f_ring":   (70, 80, 50),
            "f_pinky":  (72, 82, 52),
            "thumb":    (10, 18, 12),
        }

    for prefix, (a1, a2, a3) in curls.items():
        for seg, ang in enumerate((a1, a2, a3), start=1):
            bname = f"{prefix}.0{seg}.{side_tag}"
            if bname in pb:
                pb[bname].rotation_mode = "XYZ"
                pb[bname].rotation_euler = (math.radians(ang), 0.0, 0.0)
                if frame is not None:
                    pb[bname].keyframe_insert(data_path="rotation_euler", frame=frame)


def push_to_nla(objects, action_name, frame_end):
    for ob in objects:
        ad = ob.animation_data
        if not ad or not ad.action:
            continue
        act = ad.action
        act.name = f"{action_name}__{ob.name}"
        track = ad.nla_tracks.new()
        track.name = action_name
        strip = track.strips.new(action_name, 1, act)
        strip.action_frame_end = frame_end
        track.mute = True
        ad.action = None


def build_animations(arm_ob, cig, pack_root, lighter):
    """
    В системе координат arms_rig.blend:
      камера = (0, 0, 1.7432), вперёд = -Y, вправо = -X, вверх = +Z.
    Все позы выстраиваются относительно кости camera с итеративной подгонкой контактов (рот / пламя).
    """
    bpy.context.view_layer.update()
    CAM = arm_ob.matrix_world @ arm_ob.pose.bones["camera"].head
    MOUTH = CAM + Vector((0.0, -0.065, -0.085))  # чуть ниже объектива камеры

    # Базовые позиции IK-кистей и локтей относительно камеры
    ELBOW_R = CAM + Vector((-0.34, -0.05, -0.34))
    ELBOW_L = CAM + Vector((+0.34, -0.05, -0.34))

    HIDDEN_R = CAM + Vector((-0.26, -0.18, -0.46))
    HIDDEN_L = CAM + Vector((+0.26, -0.18, -0.46))

    PACK_L = CAM + Vector((+0.17, -0.38, -0.16))
    pack_orientation = Euler((0, 0, math.radians(-25))).to_quaternion()
    pack_offset = pack_orientation.inverted() @ Vector((-0.043, 0.006, 0.041))
    for child in pack_root.children:
        child.location += pack_offset
    PACK_ROT_L = prop_rotation(arm_ob, "handIK.L", PACK_L, (72, 12, -18),
                               pack_root, pack_orientation)

    IDLE_R = CAM + Vector((-0.15, -0.39, -0.18))
    IDLE_ROT_R = prop_rotation(arm_ob, "handIK.R", IDLE_R, (76, -18, 22),
                               cig["root"], cigarette_rotation((0.90, -0.42, 0.12), -35))

    LIGHT_R = CAM + Vector((+0.015, -0.40, -0.16))
    LIGHT_ROT_R = prop_rotation(arm_ob, "handIK.R", LIGHT_R, IDLE_ROT_R,
                                cig["root"], cigarette_rotation((0.85, -0.52, 0.06), -35))

    DRAG_ROT_R = prop_rotation(arm_ob, "handIK.R", CAM + Vector((-0.04, -0.14, -0.11)),
                               IDLE_ROT_R, cig["root"], cigarette_rotation((0.20, -0.96, 0.17), -35))

    # 1. Вычисляем точный сдвиг handIK.R для затяжки (фильтр приходит точно в MOUTH)
    set_ik_world(arm_ob, "elbowIK.R", ELBOW_R)
    DRAG_R = solve_contact(arm_ob, "handIK.R", CAM + Vector((-0.04, -0.14, -0.11)),
                           DRAG_ROT_R, cig["filter_tip"], MOUTH)

    # 2. Вычисляем точный сдвиг handIK.L для поджигания (вершина пламени касается уголька)
    set_ik_world(arm_ob, "handIK.R", LIGHT_R, LIGHT_ROT_R)
    set_ik_world(arm_ob, "elbowIK.L", ELBOW_L)
    lighter_guess = CAM + Vector((+0.07, -0.36, -0.14))
    lighter_orientation = Euler((0, 0, math.radians(15))).to_quaternion()
    LIGHT_ROT_L = prop_rotation(arm_ob, "handIK.L", lighter_guess, (78, 8, -12),
                                lighter["root"], lighter_orientation)
    set_ik_world(arm_ob, "handIK.L", lighter_guess, LIGHT_ROT_L)
    bpy.context.view_layer.update()
    lighter["root"].location += lighter["root"].matrix_world.to_3x3().inverted() @ Vector((-0.025, -0.008, 0.012))
    lighter["flame"].scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    target_flame_pos = cig["ember_tip"].matrix_world.translation + Vector((0.0, 0.0, -0.004))
    # Поправка на положение присоединённых к костям предметов после экспорта glTF.
    target_flame_pos += Vector((0.108, -0.067, 0.004))
    LIGHT_L = solve_contact(arm_ob, "handIK.L", lighter_guess, LIGHT_ROT_L,
                            lighter["flame_tip"], target_flame_pos)
    lighter["flame"].scale = (0.001, 0.001, 0.001)

    anim_objs = [arm_ob, cig["root"], pack_root, lighter["root"], lighter["flame"]]

    def set_hands(frame, pos_r, rot_r, mode_r, pos_l, rot_l, mode_l):
        set_ik_world(arm_ob, "elbowIK.R", ELBOW_R)
        set_ik_world(arm_ob, "elbowIK.L", ELBOW_L)
        set_ik_world(arm_ob, "handIK.R", pos_r, rot_r)
        set_ik_world(arm_ob, "handIK.L", pos_l, rot_l)
        for bn in ("elbowIK.R", "elbowIK.L", "handIK.R", "handIK.L"):
            key_pose_bone(arm_ob, bn, frame)
        pose_and_key_fingers(arm_ob, "R", frame, mode_r)
        pose_and_key_fingers(arm_ob, "L", frame, mode_l)

    def set_props(frame, show_pack=False, show_cig=False, show_lt=False, flame_s=0.001):
        key_obj(pack_root, frame, (1, 1, 1) if show_pack else (0.001, 0.001, 0.001))
        key_obj(cig["root"], frame, (1, 1, 1) if show_cig else (0.001, 0.001, 0.001))
        key_obj(lighter["root"], frame, (1, 1, 1) if show_lt else (0.001, 0.001, 0.001))
        key_obj(lighter["flame"], frame, (flame_s, flame_s, flame_s))

    # 1) достать_пачку (28 кадров) — [1]
    set_props(1, show_pack=True)
    set_hands(1, HIDDEN_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(28, HIDDEN_R, IDLE_ROT_R, "cigarette", PACK_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "достать_пачку", 28)

    # 2) покой_пачка (60 кадров)
    set_props(1, show_pack=True)
    set_hands(1, HIDDEN_R, IDLE_ROT_R, "cigarette", PACK_L, PACK_ROT_L, "pack")
    set_hands(30, HIDDEN_R, IDLE_ROT_R, "cigarette", PACK_L + Vector((0, 0.004, 0.006)), PACK_ROT_L, "pack")
    set_hands(60, HIDDEN_R, IDLE_ROT_R, "cigarette", PACK_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "покой_пачка", 60)

    # 3) вынуть_сигарету (48 кадров) — [E] #1
    set_props(1, show_pack=True, show_cig=False)
    set_hands(1, HIDDEN_R, IDLE_ROT_R, "pinch", PACK_L, PACK_ROT_L, "pack")
    set_hands(16, PACK_L + Vector((-0.05, 0.01, 0.05)), IDLE_ROT_R, "pinch", PACK_L, PACK_ROT_L, "pack")
    set_hands(26, PACK_L + Vector((-0.08, 0.01, 0.11)), IDLE_ROT_R, "pinch", PACK_L, PACK_ROT_L, "pack")
    key_obj(cig["root"], 25, (0.001, 0.001, 0.001))
    key_obj(cig["root"], 26, (1, 1, 1))
    set_hands(48, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    key_obj(pack_root, 47, (1, 1, 1))
    key_obj(pack_root, 48, (0.001, 0.001, 0.001))
    push_to_nla(anim_objs, "вынуть_сигарету", 48)

    # 4) покой_неподожжённая (60 кадров)
    set_props(1, show_cig=True)
    set_hands(1, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(30, IDLE_R + Vector((0, 0.004, 0.006)), IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(60, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "покой_неподожжённая", 60)

    # 5) поджечь_сигарету (68 кадров) — [E] #2
    set_props(1, show_cig=True, show_lt=True, flame_s=0.001)
    set_hands(1, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, LIGHT_ROT_L, "lighter_ready")
    set_hands(20, LIGHT_R, LIGHT_ROT_R, "cigarette", LIGHT_L, LIGHT_ROT_L, "lighter_ready")
    set_hands(26, LIGHT_R, LIGHT_ROT_R, "cigarette", LIGHT_L, LIGHT_ROT_L, "lighter_press")
    key_obj(lighter["flame"], 24, (0.001, 0.001, 0.001))
    key_obj(lighter["flame"], 28, (1.12, 1.12, 1.22))
    key_obj(lighter["flame"], 36, (0.94, 0.94, 1.04))
    key_obj(lighter["flame"], 43, (1.08, 1.08, 1.16))
    key_obj(lighter["flame"], 48, (0.001, 0.001, 0.001))
    set_hands(46, LIGHT_R, LIGHT_ROT_R, "cigarette", LIGHT_L, LIGHT_ROT_L, "lighter_press")
    set_hands(50, LIGHT_R, LIGHT_ROT_R, "cigarette", LIGHT_L, LIGHT_ROT_L, "lighter_ready")
    set_hands(68, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, LIGHT_ROT_L, "lighter_ready")
    key_obj(lighter["root"], 67, (1, 1, 1))
    key_obj(lighter["root"], 68, (0.001, 0.001, 0.001))
    push_to_nla(anim_objs, "поджечь_сигарету", 68)

    # 6) покой_курение (72 кадра)
    set_props(1, show_cig=True)
    set_hands(1, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(36, IDLE_R + Vector((-0.003, 0.004, 0.007)), IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(72, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "покой_курение", 72)

    # 7) затяжка (64 кадра) — [ЛКМ]
    set_props(1, show_cig=True)
    set_hands(1, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(20, DRAG_R, DRAG_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(38, DRAG_R, DRAG_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(64, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "затяжка", 64)

    # 8) стряхнуть_пепел (36 кадров) — [G]
    set_props(1, show_cig=True)
    set_hands(1, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(12, IDLE_R + Vector((0.02, -0.01, -0.01)), IDLE_ROT_R, "flick", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(18, IDLE_R + Vector((0.02, -0.01, -0.01)), IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(24, IDLE_R + Vector((0.02, -0.01, -0.01)), IDLE_ROT_R, "flick", HIDDEN_L, PACK_ROT_L, "pack")
    set_hands(36, IDLE_R, IDLE_ROT_R, "cigarette", HIDDEN_L, PACK_ROT_L, "pack")
    push_to_nla(anim_objs, "стряхнуть_пепел", 36)


def main():
    if not os.path.exists(ARMS_BLEND):
        raise FileNotFoundError(f"Не найден файл рига рук: {ARMS_BLEND}")
    bpy.ops.wm.open_mainfile(filepath=ARMS_BLEND)
    bpy.context.scene.render.fps = 24

    arm_ob = find_armature()
    clear_demo_animations(arm_ob)
    apply_bare_skin_texture()
    bpy.context.view_layer.update()
    camera_anchor = bpy.data.objects.new("точка_камеры", None)
    bpy.context.collection.objects.link(camera_anchor)
    camera_anchor.location = arm_ob.matrix_world @ arm_ob.pose.bones["camera"].head

    cig = build_cigarette_between_fingers(arm_ob)
    pack_root, lighter = build_pack_and_lighter(arm_ob)
    build_animations(arm_ob, cig, pack_root, lighter)

    for prop in (cig["root"], pack_root, lighter["root"], lighter["flame"]):
        prop.scale = (1, 1, 1)
    bpy.context.view_layer.update()

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_animations=True,
        export_merge_animation="NLA_TRACK",
        export_skins=True,
        export_materials="EXPORT",
    )
    print("Exported:", OUT_GLB)


if __name__ == "__main__":
    main()
