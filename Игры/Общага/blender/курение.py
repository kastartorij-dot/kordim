"""Собирает модель рук и клипы курения для камеры Godot. Blender 5.1."""
from dataclasses import dataclass
from array import array
import math
from pathlib import Path
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets/smoking_fp"
FPS_SOURCE = SOURCE / "fps-arms"
UNIT = 0.101
UP = Vector((0, 0, 1))
FPS = 24
FILTER = Vector((0, -0.026, 0))
EMBER = Vector((0, 0.057, 0))
MOUTH = Vector((0, 0.072, -0.087))
HIDDEN_SCALE = 0.002
# Крышка пачки откидывается назад вокруг оси на задней кромке, по линии разреза корпуса.
LID_HINGE = Vector((0.0, 0.0106, 0.022))
# Слоты сигарет внутри пачки: ряды 7-6-7. Верх фильтра лежит чуть ниже внутренней стороны крышки.
SLOT_TOP = 0.041
SLOT_STEP = 0.0082
SLOT_ROWS = ((-0.0064, 7), (0.0, 6), (0.0064, 7))
HOLD_DIRECTION = (-0.97, 0.24, 0.13)  # куда смотрит сигарета, когда её держит правая рука в покое
WHEEL = Vector((0.0, -0.005, 0.0345))  # колёсико в системе зажигалки
WHEEL_PAD = 0.004                      # толщина подушечки между кончиком кости и колёсиком
FIST_PALM, FIST_ALONG, FIST_LOW = 0.014, 0.030, 0.010  # центр хвата относительно костяшек и отступ вниз
FINGER_X, FINGER_Y = 0.0035, -0.0165  # кончики четырёх пальцев ложатся на переднюю грань зажигалки у правого края
THUMB_SIDE, THUMB_PALM = 0.012, 0.006  # где лежит кончик большого пальца относительно середины указательного
PULL_SLOT = Vector((0.0, -0.0064, SLOT_TOP))  # ближняя к игроку сигарета в центре переднего ряда


def material(name, color, roughness=0.65, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = emission
    return mat


def empty(name, parent=None, position=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = position
    return obj


def box(name, parent, position, dimensions, mat, bevel=0.001):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Кромки", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    obj.parent = parent
    obj.location = position
    return obj


def shared_material(name, color, roughness=0.65, emission=0):
    return bpy.data.materials.get(name) or material(name, color, roughness, emission)


def mesh_object(name, parent, verts, faces, materials, face_materials=None, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    for mat in materials:
        mesh.materials.append(mat)
    mesh.update()
    for index, polygon in enumerate(mesh.polygons):
        polygon.use_smooth = smooth
        if face_materials:
            polygon.material_index = face_materials[index]
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def split_pack(body, lid_node):
    """Режет бокс пачки по линии шарнира: корпус остаётся, верхняя часть уходит в крышку."""
    import bmesh
    inner = shared_material("картон_внутри", (0.80, 0.79, 0.75), 0.85)
    body.data.materials.append(inner)
    cap_index = len(body.data.materials) - 1
    bm = bmesh.new()
    bm.from_mesh(body.data)
    # glTF дублирует вершины на швах UV. Соединяем рёбра до разреза,
    # иначе заливка шва создаёт лишние грани поверх этикетки.
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.000001)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                           dist=0.000001, plane_co=(0, 0, LID_HINGE.z), plane_no=(0, 0, 1))
    halves = []
    for keep_upper in (False, True):
        half = bm.copy()
        drop = [f for f in half.faces if (f.calc_center_median().z > LID_HINGE.z + 1e-6) != keep_upper]
        bmesh.ops.delete(half, geom=drop, context="FACES")
        if not keep_upper:
            edge_ring = [e for e in half.edges if e.is_boundary]
            for face in bmesh.ops.holes_fill(half, edges=edge_ring)["faces"]:
                face.material_index = cap_index
        halves.append(half)
    bm.free()
    lower, upper = halves
    lower.to_mesh(body.data)
    lower.free()
    mesh = bpy.data.meshes.new("Крышка Marlboro")
    for mat in body.data.materials:
        mesh.materials.append(mat)
    bmesh.ops.translate(upper, vec=-LID_HINGE, verts=upper.verts)
    upper.to_mesh(mesh)
    upper.free()
    for polygon in mesh.polygons:
        polygon.use_smooth = False
    lid = bpy.data.objects.new("Крышка Marlboro", mesh)
    bpy.context.collection.objects.link(lid)
    lid.parent = lid_node
    # Пустая крышка накрывает выступающие фильтры и рамку пачки.
    lining = lid.modifiers.new("Картон крышки", "SOLIDIFY")
    lining.thickness = 0.00045
    lining.material_offset = cap_index
    lining.material_offset_rim = cap_index
    with bpy.context.temp_override(object=lid, active_object=lid):
        bpy.ops.object.modifier_apply(modifier=lining.name)
    return lid


def pack_interior(pack):
    """Рамка, фольга и торцы фильтров, которые видны под открытой крышкой."""
    card = shared_material("картон_внутри", (0.80, 0.79, 0.75), 0.85)
    foil = shared_material("фольга", (0.70, 0.71, 0.73), 0.45)
    cork = shared_material("пробка", (0.48, 0.25, 0.10))
    hx, hy, wall = 0.0293, 0.0100, 0.0005
    z0, z1 = LID_HINGE.z, 0.0275
    outer = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    inner = [(-hx + wall, -hy + wall), (hx - wall, -hy + wall), (hx - wall, hy - wall), (-hx + wall, hy - wall)]
    verts = [(x, y, z0) for x, y in outer] + [(x, y, z1) for x, y in outer] + \
            [(x, y, z0) for x, y in inner] + [(x, y, z1) for x, y in inner]
    faces, mats = [], []
    for i in range(4):
        j = (i + 1) % 4
        faces.append([i, j, 4 + j, 4 + i]); mats.append(0)
        faces.append([12 + i, 12 + j, 8 + j, 8 + i]); mats.append(1)
        faces.append([4 + i, 4 + j, 12 + j, 12 + i]); mats.append(0)
    mesh_object("Рамка пачки", pack, verts, faces, [card, foil], mats)
    # Остальные 19 сигарет: торцы фильтров над рамкой. Цилиндр доходит до дна рамки.
    verts, faces = [], []
    segments, radius, bottom = 12, 0.0036, z0
    for row_y, count in SLOT_ROWS:
        for k in range(count):
            x = (k - (count - 1) / 2) * SLOT_STEP
            if abs(x - PULL_SLOT.x) < 1e-6 and abs(row_y - PULL_SLOT.y) < 1e-6:
                continue
            base = len(verts)
            for z in (bottom, SLOT_TOP):
                for n in range(segments):
                    a = 2 * math.pi * n / segments
                    verts.append((x + radius * math.cos(a), row_y + radius * math.sin(a), z))
            for n in range(segments):
                m = (n + 1) % segments
                faces.append([base + n, base + m, base + segments + m, base + segments + n])
            faces.append([base + segments + n for n in range(segments)])
    mesh_object("Фильтры в пачке", pack, verts, faces, [cork], smooth=False)


def pack_model():
    prior = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "marlboro_cigarette_pack_ps1__low_poly.glb"))
    imported = set(bpy.data.objects) - prior
    bpy.context.view_layer.update()
    mesh_objects = [obj for obj in imported if obj.type == "MESH"]
    corners = [obj.matrix_world @ Vector(corner) for obj in mesh_objects for corner in obj.bound_box]
    low = Vector(tuple(min(v[i] for v in corners) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in corners) for i in range(3)))
    center = (low + high) / 2
    # Исходная пачка лежит плашмя и развёрнута на 30 градусов.
    # Лицевая сторона с логотипом после установки смотрит в сторону игрока.
    c, s = math.cos(math.pi / 6), math.sin(math.pi / 6)
    basis = Matrix(((c, s, 0), (0, 0, -1), (-s, c, 0))).to_4x4()
    transform = Matrix.Scale(0.85, 4) @ basis @ Matrix.Translation(-center)
    pack = empty("пачка_узел")
    for obj in mesh_objects:
        obj.data = obj.data.copy()
        obj.data.transform(transform @ obj.matrix_world)
        obj.name = "Пачка Marlboro"
        obj.parent = pack
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = Matrix.Identity(4)
    for obj in imported:
        if obj not in mesh_objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    lid_node = empty("крышка пачки", pack, LID_HINGE)
    split_pack(mesh_objects[0], lid_node)
    pack_interior(pack)
    return pack, lid_node


def cylinder(name, parent, start, end, radius, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=end - start)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = (0, (start + end) / 2, 0)
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return obj


def cigarette_model():
    cigarette = empty("сигарета")
    cylinder("фильтр", cigarette, FILTER.y, 0, 0.0039, shared_material("пробка", (0.48, 0.25, 0.10)))
    cylinder("бумага", cigarette, 0, 0.053, 0.004, material("бумага", (0.77, 0.74, 0.65)))
    cylinder("уголёк", cigarette, 0.053, EMBER.y, 0.0038, material("табак", (0.12, 0.065, 0.038)))
    empty("фильтр_торец", cigarette, FILTER)
    empty("уголёк_торец", cigarette, EMBER)
    return cigarette


def lighter_model():
    prior = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE / "gas_cigarette_lighter.glb"))
    imported = set(bpy.data.objects) - prior
    bpy.context.view_layer.update()
    bounds = [obj.matrix_world @ Vector(p) for obj in imported if obj.type == "MESH" for p in obj.bound_box]
    low = Vector(tuple(min(v[i] for v in bounds) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in bounds) for i in range(3)))
    lighter = empty("зажигалка")
    center = (low + high) * 0.5
    scale = 0.074 / (high.z - low.z)
    for obj in imported:
        if obj.parent not in imported:
            obj.parent = lighter
            obj.location = (obj.location - center) * scale
            obj.scale *= scale
    flame = empty("пламя_узел", lighter, (0, 0, 0.036))
    flame_mesh(flame, "язычок", (1.0, 0.37, 0.045), (0.0040, 0.0035, 0.014))
    flame_mesh(flame, "ядро", (0.18, 0.42, 0.92), (0.0027, 0.0026, 0.005))
    tip = Vector((0, 0, 0.064))
    empty("пламя_вершина", lighter, tip)
    return lighter, flame, tip


def flame_mesh(parent, name, color, radii):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=1)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = (0, 0, radii[2])
    obj.scale = radii
    obj.data.materials.append(material(name, color, emission=1.4))
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def orientation(side, forward, palm):
    along = Vector(forward).normalized()
    outward = Vector(palm) * (1 if side == "l" else -1)
    across = (outward - along * outward.dot(along)).normalized()
    return Matrix((across, along, across.cross(along))).transposed().to_quaternion()


def axes(forward):
    along = Vector(forward).normalized()
    across = along.cross(UP).normalized()
    return Matrix((across, along, across.cross(along))).transposed().to_quaternion()


@dataclass(frozen=True)
class Hand:
    wrist: Vector
    rotation: Quaternion
    grip: str


def hand(side, wrist, forward, palm, grip):
    return Hand(Vector(wrist), orientation(side, forward, palm), grip)


# Сгибы поверх штатной расслабленной позы рига. Ось пальцев зависит от стороны.
GRIPS = {
    "relax": ((0, 0, 0),) * 5,
    "smoke": ((12, 8, 4), (20, 30, 18), (24, 36, 22), (28, 40, 26), (30, 42, 28)),
    "tap": ((8, 3, 0), (11, 25, 15), (4, 5, 4), (13, 18, 9), (15, 20, 12)),
    "pack": ((15, 13, 6), (21, 26, 14), (23, 33, 16), (25, 34, 18), (25, 31, 17)),
    "pinch": ((17, 12, 7), (6, 12, 12), (13, 18, 9), (15, 22, 12), (18, 23, 14)),
    "pinch_open": ((9, 8, 4), (0, 3, 4), (11, 15, 8), (13, 19, 10), (16, 21, 12)),
    "lighter": ((11, 12, 7), (19, 23, 16), (20, 23, 16), (18, 23, 16), (17, 22, 15)),
    "press": ((23, 22, 10), (19, 23, 16), (20, 23, 16), (18, 23, 16), (17, 22, 15)),
}
GRIPS["lighter_hold"] = GRIPS["lighter"]  # углы берутся из подгонки по зажигалке
GRIPS["lighter_press"] = GRIPS["lighter"]
GRIPS["pinch_hold"] = GRIPS["pinch"]
GRIPS["pack_seam"] = GRIPS["pack"]  # углы берутся из подгонки по пачке, здесь только имена хватов
GRIPS["pack_push"] = GRIPS["pack"]
FINGERS = ("thumb", "index", "middle", "ring", "pinky")


def finger_name(side, finger, segment):
    prefix = "thumb" if finger == "thumb" else f"f_{finger}"
    return f"{prefix}.0{segment}.{side.upper()}"


class Animator:
    def __init__(self, rig, pack, lid, cigarette, lighter, flame):
        self.rig = rig
        self.bones = rig.pose.bones
        self.rig_inverse = rig.matrix_world.inverted()
        self.pack, self.lid, self.cigarette = pack, lid, cigarette
        self.lighter, self.flame = lighter, flame
        self.objects = (rig, pack, lid, cigarette, lighter, flame)
        self.euler = {}
        self.finger_axes = {}
        self.anatomical_offsets = {}
        self.custom_grips = {}
        for side in ("r", "l"):
            hand_bone = self.bones[f"hand.{side.upper()}"]
            controller = self.bones[f"hand.{side.upper()}.control"]
            index = self.bones[finger_name(side, "index", 1)].head
            pinky = self.bones[finger_name(side, "pinky", 1)].head
            along = ((index + pinky) / 2 - hand_bone.head).normalized()
            radial = index - pinky
            across = along.cross(radial).normalized()
            anatomical = Matrix((across, along, across.cross(along))).transposed().to_quaternion()
            self.anatomical_offsets[side] = anatomical.inverted() @ controller.matrix.to_quaternion()
            palm = across * (-1 if side == "r" else 1)
            for finger in FINGERS:
                for segment in range(1, 4):
                    bone = self.bones[finger_name(side, finger, segment)]
                    for constraint in bone.constraints:
                        constraint.mute = True
                    direction = bone.matrix.to_3x3().col[1]
                    axis = direction.cross(palm).normalized()
                    self.finger_axes[bone.name] = bone.matrix.to_3x3().inverted() @ axis

    def pose(self, side, a, b, t, frame=None):
        position = a.wrist.lerp(b.wrist, t)
        rotation = a.rotation.slerp(b.rotation, t)
        return self.place(side, position, rotation, a.grip, b.grip, t, frame)

    def place(self, side, position, rotation, grip_a, grip_b, t, frame=None):
        wrist = self.bones[f"hand.{side.upper()}.control"]
        rig_rotation = self.rig.matrix_world.to_quaternion()
        target = (rig_rotation.inverted() @ rotation @ self.anatomical_offsets[side]).to_matrix().to_4x4()
        wrist.rotation_mode = "QUATERNION"
        target.translation = self.rig_inverse @ position
        wrist.matrix = target
        if frame is not None:
            wrist.keyframe_insert("location", frame=frame)
            wrist.keyframe_insert("rotation_quaternion", frame=frame)
        for index, finger in enumerate(FINGERS):
            for segment in range(1, 4):
                bone = self.bones[finger_name(side, finger, segment)]
                start = GRIPS[grip_a][index][segment - 1]
                finish = GRIPS[grip_b][index][segment - 1]
                value = math.radians(start + t * (finish - start))
                bone.rotation_mode = "QUATERNION"
                if (side, grip_a) in self.custom_grips or (side, grip_b) in self.custom_grips:
                    start_rotation = self.custom_grips.get((side, grip_a), {}).get(
                        bone.name, Quaternion(self.finger_axes[bone.name], math.radians(start)))
                    finish_rotation = self.custom_grips.get((side, grip_b), {}).get(
                        bone.name, Quaternion(self.finger_axes[bone.name], math.radians(finish)))
                    bone.rotation_quaternion = start_rotation.slerp(finish_rotation, t)
                else:
                    bone.rotation_quaternion = Quaternion(self.finger_axes[bone.name], value)
                if frame is not None:
                    bone.keyframe_insert("rotation_quaternion", frame=frame)
        return position, rotation

    def fit_pack_grip(self, hand_pose, pack_position, pack_rotation, name="pack", override=None):
        self.pose("l", hand_pose, hand_pose, 0)
        bpy.context.view_layer.update()
        # Центры фаланг идут по внешним граням коробки с зазором под толщину кожи.
        targets = {
            "thumb": ((-0.061, -0.026, -0.009), (-0.038, -0.016, 0.026), (-0.024, -0.012, 0.050)),
            "index": ((0.006, 0.027, 0.030), (0.031, 0.021, 0.027), (0.036, 0.004, 0.026)),
            "middle": ((0.024, 0.042, 0.018), (0.041, 0.019, 0.014), (0.037, 0.003, 0.008)),
            "ring": ((0.007, 0.032, -0.003), (0.032, 0.021, -0.008), (0.036, 0.003, -0.012)),
            "pinky": ((0.020, 0.047, -0.018), (0.029, 0.029, -0.025), (0.039, 0.013, -0.031)),
        }
        targets.update(override or {})
        rotations = {}
        for finger, joints in targets.items():
            for segment, coordinate in enumerate(joints, 1):
                bone = self.bones[finger_name("l", finger, segment)]
                anchor = self.rig_inverse @ (pack_position + pack_rotation @ Vector(coordinate))
                direction = (anchor - bone.head).normalized()
                rotation = (bone.tail - bone.head).normalized().rotation_difference(direction)
                transform = (rotation @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
                transform.translation = bone.head
                bone.matrix = transform
                bpy.context.view_layer.update()
                rotations[bone.name] = bone.rotation_quaternion.copy()
        self.custom_grips["l", name] = rotations

    def fit_digits(self, side, tips, name, base):
        """Ставит кончики пальцев в заданные точки (мировые координаты), остальные фаланги берёт из хвата base.

        Цепочка из трёх фаланг решается методом FABRIK от текущей позы, затем каждая фаланга нацеливается на сустав.
        Рука к этому моменту уже поставлена командой place с хватом base. Возвращает промах каждого пальца в метрах.
        """
        bpy.context.view_layer.update()
        rotations = {bone: rotation.copy() for bone, rotation in self.custom_grips.get((side, base), {}).items()}
        report = {}
        for finger, tip in tips.items():
            bones = [self.bones[finger_name(side, finger, segment)] for segment in (1, 2, 3)]
            joints = [bones[0].head.copy()] + [bone.tail.copy() for bone in bones]
            lengths = [(bone.tail - bone.head).length for bone in bones]
            origin, target = joints[0].copy(), self.rig_inverse @ Vector(tip)
            for _ in range(60):
                joints[3] = target.copy()
                for i in (2, 1, 0):
                    joints[i] = joints[i + 1] + (joints[i] - joints[i + 1]).normalized() * lengths[i]
                joints[0] = origin.copy()
                for i in range(3):
                    joints[i + 1] = joints[i] + (joints[i + 1] - joints[i]).normalized() * lengths[i]
            report[finger] = round((joints[3] - target).length * UNIT, 4)
            for bone, joint in zip(bones, joints[1:]):
                direction = (joint - bone.head).normalized()
                turn = (bone.tail - bone.head).normalized().rotation_difference(direction)
                transform = (turn @ bone.matrix.to_quaternion()).to_matrix().to_4x4()
                transform.translation = bone.head
                bone.matrix = transform
                bpy.context.view_layer.update()
                rotations[bone.name] = bone.rotation_quaternion.copy()
        self.custom_grips[side, name] = rotations
        return report

    def key(self, obj, position, rotation, size, frame):
        obj.location = position
        obj.rotation_mode = "XYZ"
        obj.rotation_euler = rotation.to_euler("XYZ", self.euler.get(obj, rotation.to_euler("XYZ")))
        self.euler[obj] = obj.rotation_euler.copy()
        obj.scale = (size, size, size)
        for field in ("location", "rotation_euler", "scale"):
            obj.keyframe_insert(field, frame=frame)

    def finish(self, name, length):
        for obj in self.objects:
            animation = obj.animation_data
            action = animation.action
            action.name = f"{name}.{obj.name}"
            for channelbag in action.layers[0].strips[0].channelbags:
                for curve in channelbag.fcurves:
                    for key in curve.keyframe_points:
                        key.interpolation = "LINEAR"
            track = animation.nla_tracks.new()
            track.name = name
            strip = track.strips.new(name, 1, action)
            strip.frame_end = length
            track.mute = True
            animation.action = None
        self.euler.clear()


def smoothstep(t):
    return t * t * (3.0 - 2.0 * t)


def soften_skin(mesh):
    texture = next(node.image for node in mesh.data.materials[0].node_tree.nodes if node.type == "TEX_IMAGE")
    pixels = array("f", [0.0]) * len(texture.pixels)
    texture.pixels.foreach_get(pixels)
    for i in range(0, len(pixels), 4):
        gray = 0.27 * pixels[i] + 0.65 * pixels[i + 1] + 0.08 * pixels[i + 2]
        for channel, tint in enumerate((1.0, 0.98, 0.90)):
            pixels[i + channel] = (gray * 0.32 + pixels[i + channel] * 0.68) * tint
    texture.pixels.foreach_set(pixels)
    texture.update()
    texture.pack()


def create_clips(animator, lighter_tip):
    # Кисти стоят ниже линии взгляда, локти остаются по сторонам корпуса.
    right = hand("r", (0.208, 0.41, -0.221), (-0.64, 0.75, 0.10), (-0.52, -0.36, -0.78), "smoke")
    wrist_adjustment = Vector((0.006, 0.019, -0.010))
    left = hand("l", Vector((-0.171, 0.359, -0.208)) + wrist_adjustment,
                (0.64, 0.53, 0.55), (0.68, -0.62, -0.28), "pack")
    hidden_r = Hand(Vector((0.27, 0.21, -0.48)), right.rotation, "relax")
    hidden_l = Hand(Vector((-0.27, 0.21, -0.48)), left.rotation, "relax")
    # Положение сигареты относительно хвата измеряем по согнутым пальцам.
    animator.pose("r", right, right, 0)
    bpy.context.view_layer.update()
    bones = animator.bones
    # Сигарета лежит между средними фалангами указательного и среднего, а торец фильтра торчит позади пальцев.
    contacts = [animator.rig.matrix_world @ bones[finger_name("r", finger, 2)].head.lerp(
        bones[finger_name("r", finger, 2)].tail, 0.55) for finger in ("index", "middle")]
    cigarette_basis = right.rotation.inverted() @ axes(HOLD_DIRECTION)
    hold_point = right.rotation.inverted() @ ((contacts[0] + contacts[1]) / 2 - right.wrist)
    grip = hold_point + cigarette_basis @ Vector((0.0, 0.012, 0.0))

    def held(p, q):
        return p + q @ grip, q @ cigarette_basis

    pack_offset = Vector((0.030, 0.088, 0.018)) + left.rotation.inverted() @ (
        Vector((0.007, 0.014, -0.005)) - wrist_adjustment)
    pack_position = left.wrist + left.rotation @ pack_offset
    front = (-pack_position).normalized()
    right_edge = UP.cross(front).normalized()
    pack_rotation = Matrix((right_edge, -front, front.cross(right_edge))).transposed().to_quaternion()
    pack_rotation @= Quaternion((0, 1, 0), math.radians(4))
    pack_basis = left.rotation.inverted() @ pack_rotation
    animator.fit_pack_grip(left, pack_position, pack_rotation)
    pack_filter = pack_position + pack_rotation @ PULL_SLOT
    if "--grip-debug" in sys.argv:
        animator.pose("l", left, left, 0)
        bpy.context.view_layer.update()
        for finger in FINGERS:
            for segment in range(1, 4):
                bone = bones[finger_name("l", finger, segment)]
                w = animator.rig.matrix_world
                print("PACK", finger, segment, tuple(round(v, 3) for v in pack_rotation.inverted() @ (w @ bone.head - pack_position)),
                      tuple(round(v, 3) for v in pack_rotation.inverted() @ (w @ bone.tail - pack_position)))

    # Большой палец расслаблен и лежит вдоль указательного, с той стороны, где нет среднего.
    animator.pose("r", right, right, 0)
    bpy.context.view_layer.update()
    world = animator.rig.matrix_world
    middle_of = {f: world @ bones[finger_name("r", f, 2)].head.lerp(bones[finger_name("r", f, 2)].tail, 0.5)
                 for f in ("index", "middle")}
    side = (middle_of["index"] - middle_of["middle"]).normalized()
    cig_dir = (right.rotation @ cigarette_basis) @ Vector((0, 1, 0))
    side -= cig_dir * side.dot(cig_dir)
    palm_center = (right.wrist + sum((world @ bones[finger_name("r", f, 1)].head for f in ("index", "pinky")), Vector()) / 2) / 2
    toward_palm = palm_center - middle_of["index"]
    thumb_tip = middle_of["index"] + side.normalized() * THUMB_SIDE + toward_palm.normalized() * THUMB_PALM
    miss = animator.fit_digits("r", {"thumb": thumb_tip}, "smoke_thumb", "smoke")
    animator.custom_grips["r", "smoke"] = animator.custom_grips.pop(("r", "smoke_thumb"))
    if "--pinch-debug" in sys.argv:
        print("SMOKE thumb miss (m):", miss)

    def with_cigarette_at(point, axis, grip_name="smoke", marker=FILTER):
        prop_rotation = axes(axis)
        wrist_rotation = prop_rotation @ cigarette_basis.inverted()
        wrist = point - prop_rotation @ marker - wrist_rotation @ grip
        return Hand(wrist, wrist_rotation, grip_name)

    pick_q = orientation("r", (-0.88, 0.45, -0.11), (-0.35, -0.38, -1))
    reference = Hand(right.wrist, pick_q, "pinch")
    animator.pose("r", reference, reference, 0)
    bpy.context.view_layer.update()
    pinch = [animator.rig.matrix_world @ bones[finger_name("r", finger, 3)].tail for finger in ("index", "thumb")]
    pinch_grip = pick_q.inverted() @ ((pinch[0] + pinch[1]) / 2 - reference.wrist)
    pickup = Hand(pack_filter - pick_q @ pinch_grip, pick_q, "pinch")
    pull = Hand(pickup.wrist + Vector((0.025, 0.0, 0.061)), pick_q.slerp(right.rotation, 0.42), "pinch")
    lips = with_cigarette_at(MOUTH, (0.11, 0.97, 0.17))
    near_face = with_cigarette_at(Vector((0.091, 0.260, -0.160)), (-0.47, 0.87, 0.14))
    strike_r = Hand(Vector((0.164, 0.425, -0.198)), right.rotation, "smoke")
    ember_pos, ember_rotation = held(strike_r.wrist, strike_r.rotation)
    tip_target = ember_pos + ember_rotation @ EMBER - UP * 0.002
    lighter_orientation = Quaternion(UP, math.radians(10))
    lighter_position = tip_target - lighter_orientation @ lighter_tip
    strike_q = orientation("l", (0.45, 0.85, 0.22), (0.92, -0.38, -0.05))
    # Зажигалка стоит в кулаке: центр хвата перед костяшками, большой палец сверху на колёсике.
    animator.pose("l", Hand(Vector(), strike_q, "relax"), Hand(Vector(), strike_q, "relax"), 0)
    bpy.context.view_layer.update()
    knuckles = [strike_q.inverted() @ (animator.rig.matrix_world @ bones[finger_name("l", f, 1)].head)
                for f in ("index", "middle", "ring", "pinky")]
    fist_center = sum(knuckles, Vector()) / 4 + Vector((FIST_PALM, FIST_ALONG, 0.0))
    lighter_offset = fist_center + strike_q.inverted() @ (UP * FIST_LOW)
    strike_l = Hand(lighter_position - strike_q @ lighter_offset, strike_q, "lighter_hold")
    lighter_basis = strike_l.rotation.inverted() @ lighter_orientation
    struck = Hand(strike_l.wrist, strike_l.rotation, "lighter_press")
    low_lighter = Hand(hidden_l.wrist, strike_l.rotation, "lighter_hold")

    def fit_lighter(name, thumb_lift):
        """Четыре пальца огибают корпус зажигалки, большой лежит на колёсике (или чуть выше него)."""
        def at(local):
            return lighter_position + lighter_orientation @ Vector(local)
        tips = {"index": at((FINGER_X, FINGER_Y, 0.013)), "middle": at((FINGER_X, FINGER_Y, 0.000)),
                "ring": at((FINGER_X, FINGER_Y, -0.013)), "pinky": at((FINGER_X, FINGER_Y, -0.025)),
                "thumb": at(WHEEL + Vector((0.0, 0.0, WHEEL_PAD + thumb_lift)))}
        animator.place("l", strike_l.wrist, strike_l.rotation, "lighter", "lighter", 0)
        miss = animator.fit_digits("l", tips, name, "lighter")
        if "--pinch-debug" in sys.argv:
            print("LIGHTER", name, "miss (m):", miss)

    fit_lighter("lighter_hold", 0.010)
    fit_lighter("lighter_press", 0.0)
    flick = Hand(right.wrist + Vector((0.012, 0.013, -0.016)), right.rotation @ Quaternion((0, 1, 0), -0.17), "tap")

    # Кадры задают общую траекторию рук и предметов. Предметы привязаны к
    # хвату численно при запекании каждого кадра, без переноса Blender bone parenting в Godot.
    def bake(name, keys, pack_on=False, cig_on=False, lighter_on=False):
        for index, a in enumerate(keys[:-1]):
            b = keys[index + 1]
            end = b[0] + (index == len(keys) - 2)
            for frame in range(a[0], end):
                t = smoothstep((frame - a[0]) / (b[0] - a[0]))
                r, qr = animator.pose("r", a[1], b[1], t, frame)
                l, ql = animator.pose("l", a[2], b[2], t, frame)
                pack_p = l + ql @ pack_offset
                pack_q = ql @ pack_basis
                animator.key(animator.pack, pack_p, pack_q, 1 if pack_on else HIDDEN_SCALE, frame)
                lid_angle = (a[3] + t * (b[3] - a[3])) if pack_on else 0
                animator.key(animator.lid, LID_HINGE, Quaternion((1, 0, 0), lid_angle), 1, frame)
                cig_p, cig_q = held(r, qr)
                animator.key(animator.cigarette, cig_p, cig_q, 1 if cig_on else HIDDEN_SCALE, frame)
                animator.key(animator.lighter, l + ql @ lighter_offset, ql @ lighter_basis,
                             1 if lighter_on else HIDDEN_SCALE, frame)
                flame_on = lighter_on and 25 <= frame <= 47
                wobble = (0.90 + 0.07 * math.sin(frame * 2.1)) if flame_on else HIDDEN_SCALE
                animator.key(animator.flame, Vector((0, 0, 0.036)), Quaternion((0, 1, 0), 0.03 * math.sin(frame)), wobble, frame)
        animator.finish(name, keys[-1][0])

    # ---- Затяжка: рука идёт ко рту одним движением, без остановки на полпути. Метки кадров завязаны на игру:
    # губы 20-33, на кадре 42 рука отходит ото рта (выдох).
    def bake_drag(name="затяжка", last=62):
        def arc(a, b, via, u):
            """Одно плавное движение из a в b с небольшим уходом в сторону via, скорость колоколом."""
            return a.lerp(b, u) + (via - a.lerp(b, 0.55)) * math.sin(math.pi * u)

        speeds, prev = [], []
        for frame in range(1, last + 1):
            if frame <= 20:
                u = smoothstep((frame - 1) / 19)
                r = arc(right.wrist, lips.wrist, near_face.wrist, u)
                qr = right.rotation.slerp(lips.rotation, u)
            elif frame <= 33:
                r, qr = lips.wrist, lips.rotation
            else:
                u = smoothstep((frame - 33) / (last - 33))
                r = arc(lips.wrist, right.wrist, near_face.wrist, u)
                qr = lips.rotation.slerp(right.rotation, u)
            if "--pinch-debug" in sys.argv:
                speeds.append(round(((r - prev[0]).length * 1000) if prev else 0.0, 1))
                prev[:] = [r.copy()]
            animator.place("r", r, qr, "smoke", "smoke", 0, frame)
            l, ql = animator.pose("l", hidden_l, hidden_l, 0, frame)
            animator.key(animator.pack, l + ql @ pack_offset, ql @ pack_basis, HIDDEN_SCALE, frame)
            animator.key(animator.lid, LID_HINGE, Quaternion(), 1, frame)
            cig_p, cig_q = held(r, qr)
            animator.key(animator.cigarette, cig_p, cig_q, 1, frame)
            animator.key(animator.lighter, l + ql @ lighter_offset, ql @ lighter_basis, HIDDEN_SCALE, frame)
            animator.key(animator.flame, Vector((0, 0, 0.036)), Quaternion(), HIDDEN_SCALE, frame)
        if "--pinch-debug" in sys.argv:
            print("DRAG speed mm/frame:", speeds)
        animator.finish(name, last)

    # ---- Вынуть сигарету: большой палец откидывает крышку, правая рука берёт фильтр и вытягивает по оси пачки.
    def hermite(points, frame):
        """Плавный путь через точки [(кадр, Vector)]: скорость непрерывна, на концах руки останавливаются."""
        if frame <= points[0][0]:
            return points[0][1].copy()
        for i in range(len(points) - 1):
            f0, p0 = points[i]
            f1, p1 = points[i + 1]
            if frame <= f1:
                dt = f1 - f0
                u = (frame - f0) / dt
                m0 = (p1 - points[i - 1][1]) / (f1 - points[i - 1][0]) if i > 0 else Vector()
                m1 = (points[i + 2][1] - p0) / (points[i + 2][0] - f0) if i + 2 < len(points) else Vector()
                return ((2 * u**3 - 3 * u**2 + 1) * p0 + (u**3 - 2 * u**2 + u) * dt * m0 +
                        (-2 * u**3 + 3 * u**2) * p1 + (u**3 - u**2) * dt * m1)
        return points[-1][1].copy()

    def curve(keys, frame):
        """Скаляр по ключам (кадр, значение, режим перехода к следующему ключу)."""
        if frame <= keys[0][0]:
            return keys[0][1]
        for (f0, v0, mode), (f1, v1, _) in zip(keys, keys[1:]):
            if frame <= f1:
                u = (frame - f0) / (f1 - f0)
                u = {"in": u * u, "out": 1 - (1 - u) ** 2, "smooth": smoothstep(u), "lin": u}[mode]
                return v0 + (v1 - v0) * u
        return keys[-1][1]

    def rotated_about(point, axis, angle, hand_pose):
        q = Quaternion(axis, angle)
        return Hand(point + q @ (hand_pose.wrist - point), q @ hand_pose.rotation, hand_pose.grip)

    def bake_extraction(name="вынуть_сигарету"):
        nonlocal pinch_grip
        tilt = math.radians(15)
        left_tilted = rotated_about(pack_position, right_edge, tilt, left)
        left_tilted = Hand(left_tilted.wrist + Vector((0.055, -0.025, 0.012)), left_tilted.rotation, left_tilted.grip)
        # Палец, толкающий крышку: кончик идёт за её верхней передней кромкой.
        def on_pack(local):
            return pack_position + pack_rotation @ Vector(local)

        thumb_poses = {  # кончик большого пальца в системе пачки
            "pack_seam": (-0.022, -0.0150, 0.0215),   # под нижней передней кромкой крышки
            "pack_push": (-0.022, -0.0033, 0.0442),   # крышка откинута на 58 градусов
        }
        for grip_name, local in thumb_poses.items():
            animator.place("l", left.wrist, left.rotation, "pack", "pack", 0)
            miss = animator.fit_digits("l", {"thumb": on_pack(local)}, grip_name, "pack")
            if "--pinch-debug" in sys.argv:
                print("THUMB", grip_name, "miss (m):", miss)

        lid_keys = [(1, 0.0, "lin"), (4, 0.0, "in"), (9, math.radians(-58), "out"), (12, math.radians(-111), "smooth"),
                    (17, math.radians(-105), "lin"), (99, math.radians(-105), "lin")]
        def thumb_at(frame):
            """Большой палец: опускается к кромке крышки, толкает её вверх и возвращается на верх пачки."""
            if frame <= 4:
                return "pack", "pack_seam", smoothstep((frame - 1) / 3)
            if frame <= 9:
                return "pack_seam", "pack_push", smoothstep((frame - 4) / 5)
            return "pack_push", "pack", smoothstep(min(1.0, (frame - 9) / 6))
        tilt_keys = [(1, 0.0, "smooth"), (10, 1.0, "lin"), (99, 1.0, "lin")]
        close_frame, clear_frame, final_frame = 24, 35, 50
        lift = 0.080
        slot_basis = Quaternion((1, 0, 0), math.radians(-90))
        pinch_depth = 0.010  # от торца фильтра

        left_keys = [(1, left), (11, left_tilted), (33, left_tilted), (final_frame, hidden_l)]

        def left_at(frame):
            a = max(i for i, k in enumerate(left_keys) if k[0] <= frame) if frame < left_keys[-1][0] else len(left_keys) - 2
            (f0, h0), (f1, h1) = left_keys[a], left_keys[a + 1]
            u = smoothstep(min(1.0, max(0.0, (frame - f0) / (f1 - f0))))
            return h0.wrist.lerp(h1.wrist, u), h0.rotation.slerp(h1.rotation, u)

        def pack_pose_at(frame):
            l, ql = left_at(frame)
            return l + ql @ pack_offset, ql @ pack_basis

        # Положение рук и сигареты в системе пачки после закрытия щипка.
        pick_point_local = PULL_SLOT + Vector((0, 0, -pinch_depth))
        def cig_slot_pose(frame, s):
            pack_p, pack_q = pack_pose_at(frame)
            q = pack_q @ slot_basis
            filter_end = pack_p + pack_q @ (PULL_SLOT + Vector((0, 0, s)))
            return filter_end - q @ FILTER, q

        # Подход правой руки к фильтру: чуть сзади и выше, затем смыкание пальцев.
        def pinch_hand(frame, s, rotation, grip_a, grip_b, t):
            pack_p, pack_q = pack_pose_at(frame)
            point = pack_p + pack_q @ (pick_point_local + Vector((0, 0, s)))
            return point - rotation @ pinch_grip, rotation

        pickup_q = pick_q
        pack_up = (pack_rotation @ Vector((0, 0, 1))).normalized()
        approach_offset = -(pickup_q @ Vector((0, 1, 0))) * 0.065 + pack_up * 0.020
        right_waypoints = None

        close_wrist, close_q = pinch_hand(close_frame, 0.0, pickup_q, "pinch", "pinch", 0)
        close_pack_p, close_pack_q = pack_pose_at(close_frame)
        cig_axis_point = close_pack_p + close_pack_q @ pick_point_local
        across = close_pack_q @ Vector((0, 1, 0))  # от большого пальца (спереди) к указательному (сзади)
        pads = {"thumb": cig_axis_point - across * 0.0085 - UP * 0.002,
                "index": cig_axis_point + across * 0.0085 + UP * 0.002}
        shift = Vector()
        for _ in range(6):  # сдвигаем кисть, пока оба пальца не достанут до своих точек
            animator.place("r", close_wrist + shift, close_q, "pinch", "pinch", 0)
            reach = animator.fit_digits("r", pads, "pinch_hold", "pinch")
            world = animator.rig.matrix_world
            miss = sum(((pads[f] - world @ animator.bones[finger_name("r", f, 3)].tail) for f in pads), Vector())
            if max(reach.values()) < 0.0008:
                break
            shift += miss * 0.5
        pinch_grip = pinch_grip - close_q.inverted() @ shift
        if "--pinch-debug" in sys.argv:
            print("PINCH reach residual (m):", reach)

        for frame in range(1, final_frame + 1):
            lid_angle = curve(lid_keys, frame)
            l_pose = left_at(frame)
            # правая рука
            if frame <= 8:
                r, qr, ga, gb, tg = hidden_r.wrist, hidden_r.rotation, "relax", "relax", 0.0
            elif frame <= close_frame:
                end, _ = pinch_hand(close_frame, 0.0, pickup_q, "pinch", "pinch", 0)
                start = hidden_r.wrist
                mid = end + approach_offset
                path = [(8, start), (17, mid), (close_frame - 1, end + approach_offset * 0.15), (close_frame, end)]
                r = hermite(path, frame)
                qr = hidden_r.rotation.slerp(pickup_q, smoothstep((frame - 8) / (close_frame - 8)))
                ga, gb = ("relax", "pinch_open") if frame <= 17 else ("pinch_open", "pinch_hold")
                tg = smoothstep((frame - 8) / 9) if frame <= 17 else smoothstep((frame - 17) / (close_frame - 17))
            elif frame <= clear_frame:
                s = lift * smoothstep((frame - close_frame) / (clear_frame - close_frame))
                r, qr = pinch_hand(frame, s, pickup_q, "pinch", "pinch", 0)
                ga, gb, tg = "pinch_hold", "pinch_hold", 0.0
            else:
                # Рука несёт сигарету к исходной позе курильщика, хват меняется со щипка на «рука-указка».
                start_r, start_q = pinch_hand(clear_frame, lift, pickup_q, "pinch", "pinch", 0)
                u = smoothstep((frame - clear_frame) / (final_frame - clear_frame))
                mid = start_r.lerp(right.wrist, 0.5) + Vector((0.0, -0.02, 0.035))
                r = hermite([(clear_frame, start_r), ((clear_frame + final_frame) // 2, mid), (final_frame, right.wrist)], frame)
                qr = start_q.slerp(right.rotation, u)
                ga, gb, tg = "pinch_hold", "smoke", u
            animator.place("r", r, qr, ga, gb, tg, frame)
            thumb_a, thumb_b, thumb_t = thumb_at(frame)
            animator.place("l", l_pose[0], l_pose[1], thumb_a, thumb_b, thumb_t, frame)
            pack_p, pack_q = pack_pose_at(frame)
            if "--pinch-debug" in sys.argv and frame in (close_frame, clear_frame):
                bpy.context.view_layer.update()
                w = animator.rig.matrix_world
                print("PINCH frame", frame, "cig filter(local)", tuple(round(v, 4) for v in (PULL_SLOT + Vector((0, 0, -pinch_depth)))))
                for finger in ("thumb", "index", "middle"):
                    for segment in (2, 3):
                        bone = animator.bones[finger_name("r", finger, segment)]
                        print("  ", finger, segment, "head", tuple(round(v, 4) for v in pack_q.inverted() @ (w @ bone.head - pack_p)),
                              "tail", tuple(round(v, 4) for v in pack_q.inverted() @ (w @ bone.tail - pack_p)))
            animator.key(animator.pack, pack_p, pack_q, 1, frame)
            animator.key(animator.lid, LID_HINGE, Quaternion((1, 0, 0), lid_angle), 1, frame)
            # сигарета
            if frame <= close_frame:
                cig_p, cig_q = cig_slot_pose(frame, 0.0)
            elif frame <= clear_frame:
                cig_p, cig_q = cig_slot_pose(frame, lift * smoothstep((frame - close_frame) / (clear_frame - close_frame)))
            else:
                hold_p, hold_q = cig_slot_pose(clear_frame, lift)
                wrist0, rot0 = pinch_hand(clear_frame, lift, pickup_q, "pinch", "pinch", 0)
                rel_p = rot0.inverted() @ (hold_p - wrist0)
                rel_q = rot0.inverted() @ hold_q
                a = smoothstep(min(1.0, max(0.0, (frame - clear_frame - 2) / (final_frame - clear_frame - 6))))
                cig_p = r + qr @ rel_p.lerp(grip, a)
                cig_q = qr @ rel_q.slerp(cigarette_basis, a)
            animator.key(animator.cigarette, cig_p, cig_q, 1, frame)
            animator.key(animator.lighter, l_pose[0] + l_pose[1] @ lighter_offset, l_pose[1] @ lighter_basis, HIDDEN_SCALE, frame)
            animator.key(animator.flame, Vector((0, 0, 0.036)), Quaternion(), HIDDEN_SCALE, frame)
        animator.finish(name, final_frame)

    lid_open = math.radians(-105)
    low_pack = Hand(hidden_l.wrist, left.rotation, "pack")
    settle = Hand(left.wrist + Vector((0.004, 0.011, 0.006)), left.rotation, "pack")
    bake("достать_пачку", [(1, hidden_r, low_pack, 0), (20, hidden_r, settle, 0),
                           (26, hidden_r, left, 0)], pack_on=True)
    breathe = Hand(left.wrist + Vector((0.001, 0.003, 0.002)), left.rotation, "pack")
    bake("покой_пачка", [(1, hidden_r, left, 0), (32, hidden_r, breathe, 0),
                         (64, hidden_r, left, 0)], pack_on=True)
    bake_extraction()
    for clip in ("покой_неподожжённая", "покой_курение"):
        rest = Hand(right.wrist + Vector((0.001, 0.004, 0.003)), right.rotation, right.grip)
        bake(clip, [(1, right, hidden_l, 0), (38, rest, hidden_l, 0), (75, right, hidden_l, 0)], cig_on=True)
    bake("поджечь_сигарету", [(1, right, low_lighter, 0), (17, strike_r, strike_l, 0),
                             (25, strike_r, struck, 0), (46, strike_r, struck, 0),
                             (52, strike_r, strike_l, 0), (65, right, low_lighter, 0)], cig_on=True, lighter_on=True)
    bake_drag()
    bake("стряхнуть_пепел", [(1, right, hidden_l, 0), (12, flick, hidden_l, 0),
                             (19, right, hidden_l, 0), (30, right, hidden_l, 0)], cig_on=True)
    bake("убрать_пачку", [(1, hidden_r, left, 0), (19, hidden_r, low_pack, 0)], pack_on=True)
    bake("убрать_сигарету", [(1, right, hidden_l, 0), (16, hidden_r, hidden_l, 0)], cig_on=True)


def main():
    output = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else ROOT / "models/руки_сигарета.glb"
    bpy.ops.wm.open_mainfile(filepath=str(FPS_SOURCE / "FPS ARMS RIG 1.blend"))
    scene = bpy.context.scene
    scene.render.fps = FPS
    rig = next(obj for obj in scene.objects if obj.type == "ARMATURE")
    mesh = next(obj for obj in scene.objects if obj.type == "MESH" and obj.find_armature() == rig)
    rig.animation_data_clear()
    rig.location = (0, -0.10, -0.225)
    rig.scale = (UNIT,) * 3
    mesh.animation_data_clear()
    mesh.matrix_parent_inverse = Matrix.Identity(4)
    mesh.location = (0, 0, 0)
    mesh.rotation_euler = (0, 0, 0)
    mesh.scale = (1, 1, 1)
    if mesh.parent != rig:
        mesh.parent = rig
    skin = material("кожа FPS ARMS", (1, 1, 1), 0.74)
    tex = skin.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(FPS_SOURCE / "new_diff.png"), check_existing=True)
    skin.node_tree.links.new(tex.outputs["Color"], skin.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    mesh.data.materials[0] = skin
    for face in mesh.data.polygons:
        face.use_smooth = True
    for obj in list(scene.objects):
        if obj not in {rig, mesh}:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()
    pack, lid = pack_model()
    cigarette = cigarette_model()
    lighter, flame, flame_tip = lighter_model()
    empty("точка_камеры")
    create_clips(Animator(rig, pack, lid, cigarette, lighter, flame), flame_tip)
    for prop in (pack, lid, lighter, flame, cigarette):
        prop.scale = (1, 1, 1)
    bpy.context.view_layer.update()
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", export_merge_animation="NLA_TRACK",
                             export_frame_range=False, export_anim_slide_to_zero=True, export_cameras=False,
                             export_anim_single_armature=False)


if __name__ == "__main__":
    main()
