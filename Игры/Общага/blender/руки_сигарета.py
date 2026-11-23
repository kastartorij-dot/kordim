# Улучшенная модель рук от первого лица, сигареты и газовой зажигалки с 4 отдельными анимациями.
# Запуск из корня проекта:
#   python3 blender/руки_сигарета_текстуры.py
#   blender --background --python blender/руки_сигарета.py
# Экспортирует в models/руки_сигарета.glb с 4 NLA-клипами:
#   1) достать_и_поджечь  (76 кадров @ 24 fps)
#   2) затяжка            (62 кадра  @ 24 fps)
#   3) покой_курение      (72 кадра  @ 24 fps, бесшовный цикл)
#   4) стряхнуть_пепел    (36 кадров @ 24 fps)

import bpy
import math
import os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX_DIR = os.path.join(ROOT, "textures")
OUT_GLB = os.path.join(ROOT, "models", "руки_сигарета.glb")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 24


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


def smooth(ob):
    for poly in ob.data.polygons:
        poly.use_smooth = True


def add_empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = loc
    e.rotation_euler = tuple(math.radians(a) for a in rot)
    if parent:
        e.parent = parent
    return e


def add_limb(name, r1, r2, length, loc, rot, mat, parent, segs=16, cap_end=True):
    bpy.ops.mesh.primitive_cone_add(
        vertices=segs, radius1=r1, radius2=r2, depth=length, location=(0, 0, length / 2)
    )
    ob = bpy.context.object
    ob.name = name
    bpy.ops.object.transform_apply(location=True)
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    ob.data.materials.append(mat)
    smooth(ob)
    ob.parent = parent
    if cap_end:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=8, radius=r2, location=(0, 0, length))
        tip = bpy.context.object
        tip.name = f"{name}_сустав"
        tip.scale = (1.0, 1.0, 0.85)
        bpy.ops.object.transform_apply(scale=True)
        tip.data.materials.append(mat)
        smooth(tip)
        tip.parent = ob
    return ob


def add_sculpt_box(name, size, loc, rot, mat, parent, bevel=0.006, segs=3):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0))
    ob = bpy.context.object
    ob.name = name
    ob.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        bpy.ops.object.modifier_apply(modifier="Bevel")
    ob.location = loc
    ob.rotation_euler = tuple(math.radians(a) for a in rot)
    ob.data.materials.append(mat)
    smooth(ob)
    ob.parent = parent
    return ob


def build_hand(side, root, skin_mat, nail_mat, sleeve_mat, cuff_mat, grip_mode="cigarette"):
    """
    side: +1 (правая рука), -1 (левая рука).
    Локальные оси руки: +Y вперёд (к пальцам), +Z вверх (тыльная сторона), +X вправо.
    Возвращает словарь ключевых узлов для анимации.
    """
    tag = "R" if side > 0 else "L"
    hand_root = add_empty(f"рука_{tag}", parent=root)

    # Рукав толстовки + рельефная манжета + запястье
    add_limb(f"рукав_{tag}", 0.062, 0.044, 0.55, (0, -0.639, -0.041), (-86, 0, 0), sleeve_mat, hand_root, 18, False)
    add_limb(f"манжета_{tag}", 0.045, 0.041, 0.045, (0, -0.095, -0.008), (-87, 0, 0), cuff_mat, hand_root, 18, False)
    add_limb(f"запястье_{tag}", 0.034, 0.030, 0.072, (0, -0.062, -0.004), (-88, 0, 0), skin_mat, hand_root, 16, False)

    # Скруглённая ладонь + подушечка большого пальца (тенар) + костяшки
    add_sculpt_box(f"ладонь_{tag}", (0.078, 0.084, 0.026), (0, 0.036, 0.0), (0, 0, 0), skin_mat, hand_root, bevel=0.011, segs=3)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=1.0, location=(-0.022 * side, 0.024, -0.008))
    thenar = bpy.context.object
    thenar.name = f"тенар_{tag}"
    thenar.scale = (0.022, 0.028, 0.015)
    bpy.ops.object.transform_apply(scale=True)
    thenar.data.materials.append(skin_mat)
    smooth(thenar)
    thenar.parent = hand_root

    # 4 пальца по 3 фаланги + ногтевые пластинки
    finger_specs = [
        ("указ", -0.027 * side, 0.034, 0.022, 0.018, 0.0090),
        ("сред", -0.009 * side, 0.038, 0.025, 0.019, 0.0093),
        ("безм",  0.010 * side, 0.034, 0.022, 0.018, 0.0086),
        ("миз",   0.028 * side, 0.027, 0.018, 0.015, 0.0074),
    ]
    finger_joints = {}
    for idx, (fname, fx, l1, l2, l3, rad) in enumerate(finger_specs):
        if grip_mode == "cigarette":
            curl1 = 12 if idx < 2 else 64
            curl2 = 14 if idx < 2 else 74
            curl3 = 10 if idx < 2 else 52
            splay = (-7.5 if idx == 0 else (7.5 if idx == 1 else 0)) * side
        else:
            curl1 = 58
            curl2 = 74
            curl3 = 48
            splay = 0

        j1 = add_empty(f"{fname}_1_{tag}", (fx, 0.075, 0.002), (-curl1, 0, splay), hand_root)
        add_limb(f"{fname}_фал1_{tag}", rad, rad * 0.90, l1, (0, 0, 0), (-90, 0, 0), skin_mat, j1, 12)
        j2 = add_empty(f"{fname}_2_{tag}", (0, l1, 0), (-curl2, 0, 0), j1)
        add_limb(f"{fname}_фал2_{tag}", rad * 0.88, rad * 0.78, l2, (0, 0, 0), (-90, 0, 0), skin_mat, j2, 12)
        j3 = add_empty(f"{fname}_3_{tag}", (0, l2, 0), (-curl3, 0, 0), j2)
        add_limb(f"{fname}_фал3_{tag}", rad * 0.76, rad * 0.64, l3, (0, 0, 0), (-90, 0, 0), skin_mat, j3, 12)
        # Ноготь
        add_sculpt_box(f"{fname}_ноготь_{tag}", (rad * 1.15, l3 * 0.62, 0.0025),
                       (0, l3 * 0.62, rad * 0.62), (0, 0, 0), nail_mat, j3, bevel=0.001, segs=1)
        finger_joints[fname] = (j1, j2, j3)

    # Большой палец (2 подвижные фаланги + ноготь)
    thumb_rot = (-28, 22 * side, -36 * side) if grip_mode == "cigarette" else (14, -18 * side, 22 * side)
    thumb = add_empty(f"большой_{tag}", (-0.036 * side, 0.028, 0.006 if grip_mode == "lighter" else -0.006),
                      thumb_rot, hand_root)
    add_limb(f"большой_фал1_{tag}", 0.0114, 0.0098, 0.034, (0, 0, 0), (-90, 0, 0), skin_mat, thumb, 12)
    thumb2 = add_empty(f"большой_2_{tag}", (0, 0.034, 0), (-20, 0, 0), thumb)
    add_limb(f"большой_фал2_{tag}", 0.0096, 0.0078, 0.026, (0, 0, 0), (-90, 0, 0), skin_mat, thumb2, 12)
    add_sculpt_box(f"большой_ноготь_{tag}", (0.010, 0.012, 0.0025),
                   (0, 0.016, 0.0065), (0, 0, 0), nail_mat, thumb2, bevel=0.001, segs=1)

    return {"root": hand_root, "thumb": thumb, "thumb2": thumb2, "fingers": finger_joints}


def build_cigarette(parent):
    cig = add_empty("сигарета", (-0.018, 0.112, 0.005), (6, 0, 26), parent)
    cig_body_mat = make_mat("сигарета_корпус", (0.93, 0.91, 0.87), 0.88, tex_file="сигарета_текстура.png")
    filter_mat = make_mat("сигарета_фильтр", (0.80, 0.52, 0.24), 0.84)
    gold_mat = make_mat("сигарета_кольцо", (0.80, 0.66, 0.34), 0.35, metallic=0.65)
    ash_mat = make_mat("сигарета_пепел", (0.26, 0.25, 0.25), 0.96)
    ember_mat = make_mat("сигарета_уголёк", (0.20, 0.08, 0.05), 0.80,
                         emit=(1.0, 0.30, 0.03), emit_strength=0.0)

    # Фильтр + золотое колечко + бумага + зона пепла + тлеющий уголёк
    add_limb("фильтр", 0.0040, 0.0040, 0.024, (0, -0.024, 0), (-90, 0, 0), filter_mat, cig, 16, False)
    add_limb("кольцо_фильтра", 0.00408, 0.00408, 0.0018, (0, 0.0, 0), (-90, 0, 0), gold_mat, cig, 16, False)
    add_limb("бумага", 0.0040, 0.0039, 0.052, (0, 0.0018, 0), (-90, 0, 0), cig_body_mat, cig, 16, False)
    add_limb("пепел", 0.0039, 0.0034, 0.006, (0, 0.0538, 0), (-90, 0, 0), ash_mat, cig, 14, False)
    ember = add_limb("уголёк", 0.0034, 0.0020, 0.0045, (0, 0.0598, 0), (-90, 0, 0), ember_mat, cig, 14, True)
    return cig, ember, ember_mat


def build_lighter(parent):
    # Зажигалка стоит строго вертикально (поворот -72° по Y компенсирует разворот левой кисти ребром)
    lighter = add_empty("зажигалка", (0.012, 0.068, 0.022), (0, -72, 0), parent)
    body_mat = make_mat("зажигалка_корпус", (0.82, 0.10, 0.09), 0.20)
    base_mat = make_mat("зажигалка_дно", (0.12, 0.12, 0.13), 0.55)
    metal_mat = make_mat("зажигалка_металл", (0.82, 0.84, 0.87), 0.20, metallic=0.90)
    brass_mat = make_mat("зажигалка_форсунка", (0.80, 0.64, 0.28), 0.30, metallic=0.85)
    wheel_mat = make_mat("зажигалка_колёсико", (0.20, 0.20, 0.22), 0.42, metallic=0.72)
    flame_outer_mat = make_mat("зажигалка_пламя", (1.0, 0.74, 0.20), 0.08,
                               emit=(1.0, 0.58, 0.09), emit_strength=16.0)
    flame_core_mat = make_mat("зажигалка_ядро", (0.35, 0.68, 1.0), 0.08,
                              emit=(0.30, 0.66, 1.0), emit_strength=18.0)

    # Корпус BIC со скруглёнными краями и чёрным донышком
    add_sculpt_box("корпус_зажигалки", (0.024, 0.0135, 0.062), (0, 0, 0.0), (0, 0, 0), body_mat, lighter, bevel=0.005, segs=3)
    add_sculpt_box("дно_зажигалки", (0.022, 0.012, 0.004), (0, 0, -0.032), (0, 0, 0), base_mat, lighter, bevel=0.001, segs=1)
    # Стальной ветрозащитный кожух + латунная форсунка
    add_sculpt_box("кожух_зажигалки", (0.023, 0.0128, 0.018), (0, 0, 0.039), (0, 0, 0), metal_mat, lighter, bevel=0.002, segs=2)
    add_limb("форсунка", 0.0022, 0.0018, 0.007, (0.0055, 0.0, 0.044), (0, 0, 0), brass_mat, lighter, 10, False)

    # Вращающееся колёсико и нажимаемая красная клавиша газа
    wheel = add_empty("колёсико_узел", (-0.0045, 0.0, 0.048), (0, 0, 0), lighter)
    add_limb("колёсико", 0.0050, 0.0050, 0.0055, (0, -0.00275, 0), (-90, 0, 0), wheel_mat, wheel, 16, False)
    lever = add_empty("клавиша_газа_узел", (-0.003, 0.0, 0.039), (0, 0, 0), lighter)
    add_sculpt_box("клавиша_газа", (0.010, 0.0085, 0.005), (-0.005, 0, 0.002), (0, 0, 0), body_mat, lever, bevel=0.001, segs=1)

    # Двухслойное анимированное пламя (внешний язычок + голубое ядро)
    flame_root = add_empty("пламя_узел", (0.0055, 0.0, 0.052), (0, 0, 0), lighter)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.0068, location=(0, 0, 0.015))
    fl_out = bpy.context.object
    fl_out.name = "пламя_внешнее"
    fl_out.scale = (0.62, 0.62, 2.25)
    bpy.ops.object.transform_apply(location=True, scale=True)
    fl_out.data.materials.append(flame_outer_mat)
    smooth(fl_out)
    fl_out.parent = flame_root

    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=0.0034, location=(0, 0, 0.008))
    fl_in = bpy.context.object
    fl_in.name = "пламя_ядро"
    fl_in.scale = (0.60, 0.60, 1.80)
    bpy.ops.object.transform_apply(location=True, scale=True)
    fl_in.data.materials.append(flame_core_mat)
    smooth(fl_in)
    fl_in.parent = flame_root

    flame_root.scale = (0.001, 0.001, 0.001)
    return {"root": lighter, "wheel": wheel, "lever": lever, "flame": flame_root}


def key(obj, frame, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
        obj.keyframe_insert(data_path="location", frame=frame)
    if rot is not None:
        obj.rotation_euler = tuple(math.radians(a) for a in rot)
        obj.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        obj.scale = scale
        obj.keyframe_insert(data_path="scale", frame=frame)


def push_to_nla(objects, action_name, frame_end):
    """Сохраняет текущие ключевые кадры в отдельный NLA-трек с именем action_name для экспорта в GLB."""
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


def build_animations(hand_r, hand_l, lighter, ember):
    hr, hl = hand_r["root"], hand_l["root"]
    tl = hand_l["thumb"]
    idx_r = hand_r["fingers"]["указ"][0]
    wheel, lever, flame = lighter["wheel"], lighter["lever"], lighter["flame"]
    anim_objs = [hr, hl, tl, idx_r, wheel, lever, flame]

    # --- КЛИП 1: достать_и_поджечь (76 кадров) ---
    key(hr, 1,  loc=(0.24, 0.24, -0.32), rot=(12, -18, 22))
    key(hl, 1,  loc=(-0.22, 0.22, -0.34), rot=(10, 72, -18))
    key(hr, 22, loc=(0.14, 0.34, -0.10), rot=(16, -24, 34))
    key(hl, 22, loc=(-0.13, 0.36, -0.11), rot=(6, 72, -14))

    # Подводим зажигалку ровно под кончик сигареты (левая рука чуть левее: x=-0.095)
    key(hr, 34, loc=(0.08, 0.36, -0.06), rot=(12, -26, 44))
    key(hl, 34, loc=(-0.095, 0.39, -0.115), rot=(4, 72, -8))

    # Чирок большим пальцем + прокрутка колёсика + нажатие клавиши газа
    key(tl, 30, rot=(14, 18, -22))
    key(tl, 37, rot=(-26, 18, -10))
    key(tl, 43, rot=(-16, 18, -14))
    key(tl, 60, rot=(10, 18, -20))

    key(wheel, 30, rot=(0, 0, 0))
    key(wheel, 38, rot=(0, 320, 0))
    key(lever, 34, rot=(0, 0, 0))
    key(lever, 38, rot=(0, -18, 0))
    key(lever, 56, rot=(0, -18, 0))
    key(lever, 60, rot=(0, 0, 0))

    # Пламя вспыхивает и мягко колышется прямо под кончиком сигареты
    key(flame, 35, scale=(0.001, 0.001, 0.001), rot=(0, 0, 0))
    key(flame, 39, scale=(1.12, 1.12, 1.24), rot=(4, -3, 0))
    key(flame, 45, scale=(0.94, 0.94, 1.06), rot=(-5, 4, 0))
    key(flame, 52, scale=(1.06, 1.06, 1.18), rot=(3, 2, 0))
    key(flame, 59, scale=(0.001, 0.001, 0.001), rot=(0, 0, 0))

    key(hr, 56, loc=(0.08, 0.36, -0.06), rot=(12, -26, 44))
    key(hl, 56, loc=(-0.095, 0.39, -0.115), rot=(4, 72, -8))

    # Опускаем левую руку и переводим правую в расслабленный хват
    key(hl, 76, loc=(-0.26, 0.20, -0.44), rot=(16, 72, -28))
    key(hr, 76, loc=(0.14, 0.33, -0.10), rot=(10, -22, 26))

    # Сводим верх пламени с кончиком сигареты в середине поджигания.
    bpy.context.scene.frame_set(45)
    contact = ember.matrix_world @ Vector((0, 0, 0.005))
    flame_tip = flame.matrix_world @ Vector((0, 0, 0.0303))
    grip = hl.location + contact - flame_tip
    key(hl, 34, loc=grip)
    key(hl, 56, loc=grip)
    bpy.context.scene.frame_set(1)
    push_to_nla(anim_objs, "достать_и_поджечь", 76)

    # --- КЛИП 2: затяжка (62 кадра) ---
    key(hl, 1,  loc=(-0.26, 0.20, -0.44), rot=(16, 72, -28))
    key(hr, 1,  loc=(0.14, 0.33, -0.10), rot=(10, -22, 26))
    key(hr, 18, loc=(0.07, 0.18, -0.04), rot=(24, -12, 58))
    key(hr, 36, loc=(0.06, 0.17, -0.03), rot=(26, -10, 60))
    key(hr, 62, loc=(0.14, 0.33, -0.10), rot=(10, -22, 26))
    push_to_nla(anim_objs, "затяжка", 62)

    # --- КЛИП 3: покой_курение (72 кадра, цикл дыхания) ---
    key(hl, 1,  loc=(-0.26, 0.20, -0.44), rot=(16, 72, -28))
    key(hr, 1,  loc=(0.14, 0.33, -0.100), rot=(10.0, -22.0, 26.0))
    key(hr, 36, loc=(0.144, 0.326, -0.093), rot=(11.8, -20.5, 24.5))
    key(hr, 72, loc=(0.14, 0.33, -0.100), rot=(10.0, -22.0, 26.0))
    push_to_nla(anim_objs, "покой_курение", 72)

    # --- КЛИП 4: стряхнуть_пепел (36 кадров) ---
    key(hl, 1,  loc=(-0.26, 0.20, -0.44), rot=(16, 72, -28))
    key(hr, 1,  loc=(0.14, 0.33, -0.10), rot=(10, -22, 26))
    key(hr, 12, loc=(0.11, 0.35, -0.11), rot=(4, -34, 32))
    key(idx_r, 1,  rot=(-12, 0, -7.5))
    key(idx_r, 12, rot=(-36, 0, -7.5))  # лёгкий щелчок указательным пальцем
    key(idx_r, 18, rot=(-10, 0, -7.5))
    key(idx_r, 24, rot=(-32, 0, -7.5))
    key(idx_r, 36, rot=(-12, 0, -7.5))
    key(hr, 36, loc=(0.14, 0.33, -0.10), rot=(10, -22, 26))
    push_to_nla(anim_objs, "стряхнуть_пепел", 36)


def main():
    clear_scene()
    root = add_empty("fp_smoking_root")

    skin_mat = make_mat("кожа_рук", (0.76, 0.56, 0.44), 0.68)
    nail_mat = make_mat("ногти", (0.86, 0.72, 0.66), 0.35)
    sleeve_mat = make_mat("рукав_худи", (0.16, 0.18, 0.21), 0.90, tex_file="рукав_ткань.png")
    cuff_mat = make_mat("манжета_худи", (0.13, 0.15, 0.18), 0.92, tex_file="рукав_ткань.png")

    hand_r = build_hand(+1, root, skin_mat, nail_mat, sleeve_mat, cuff_mat, grip_mode="cigarette")
    hand_l = build_hand(-1, root, skin_mat, nail_mat, sleeve_mat, cuff_mat, grip_mode="lighter")
    _, ember, _ = build_cigarette(hand_r["root"])
    lighter = build_lighter(hand_l["root"])

    build_animations(hand_r, hand_l, lighter, ember)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_animations=True,
        export_nla_strips=True,
        export_materials="EXPORT",
    )
    print("Exported:", OUT_GLB)


if __name__ == "__main__":
    main()
