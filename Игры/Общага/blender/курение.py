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
UNIT = 0.112
UP = Vector((0, 0, 1))
FPS = 24
FILTER = Vector((0, -0.026, 0))
EMBER = Vector((0, 0.057, 0))
MOUTH = Vector((0, 0.050, -0.090))
HIDDEN_SCALE = 0.002


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


def pack_model():
    pack = empty("пачка_узел")
    card = material("картон пачки", (0.52, 0.48, 0.37))
    burgundy = material("вишнёвая печать", (0.25, 0.022, 0.024))
    foil = material("фольга", (0.52, 0.50, 0.42), 0.38)
    box("корпус пачки", pack, (0, 0, -0.009), (0.053, 0.022, 0.063), card)
    box("цветной пояс", pack, (0, 0, -0.021), (0.0535, 0.0225, 0.024), burgundy)
    box("фольга в пачке", pack, (0, 0, 0.024), (0.050, 0.019, 0.005), foil)
    paper = material("бумажные гильзы", (0.59, 0.45, 0.28))
    for row in (-1, 1):
        for column in (-2, -1, 0, 1, 2):
            if (row, column) == (-1, 0):
                continue
            item = cylinder("фильтр в пачке", pack, 0.023, 0.030, 0.0037, paper)
            item.location = (column * 0.0085, row * 0.0045, 0.0265)
            item.rotation_euler.x = 0
    lid = empty("крышка пачки", pack, (0, 0.010, 0.022))
    box("картон крышки", lid, (0, -0.010, 0.011), (0.054, 0.023, 0.021), burgundy)
    return pack, lid


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
    cylinder("фильтр", cigarette, FILTER.y, 0, 0.0039, material("пробка", (0.48, 0.25, 0.10)))
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
    "smoke": ((8, 3, 0), (2, 5, 4), (4, 5, 4), (13, 18, 9), (15, 20, 12)),
    "tap": ((8, 3, 0), (11, 25, 15), (4, 5, 4), (13, 18, 9), (15, 20, 12)),
    "pack": ((12, 9, 4), (16, 20, 10), (18, 24, 12), (18, 26, 14), (20, 24, 13)),
    "pinch": ((17, 12, 7), (6, 12, 12), (13, 18, 9), (15, 22, 12), (18, 23, 14)),
    "lighter": ((11, 12, 7), (19, 23, 16), (20, 23, 16), (18, 23, 16), (17, 22, 15)),
    "press": ((23, 22, 10), (19, 23, 16), (20, 23, 16), (18, 23, 16), (17, 22, 15)),
}
FINGERS = ("thumb", "index", "middle", "ring", "pinky")


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
        for side in ("r", "l"):
            palm = self.bones[f"wrist.{side}"].matrix.to_3x3() @ Vector((-1 if side == "r" else 1, 0, 0))
            for finger in FINGERS:
                for segment in range(1, 4):
                    bone = self.bones[f"finger_{finger}{segment}.{side}"]
                    direction = bone.matrix.to_3x3().col[1]
                    axis = direction.cross(palm).normalized()
                    self.finger_axes[bone.name] = bone.matrix.to_3x3().inverted() @ axis

    def pose(self, side, a, b, t, frame=None):
        wrist = self.bones[f"wrist_ik.{side}"]
        position = a.wrist.lerp(b.wrist, t)
        rotation = a.rotation.slerp(b.rotation, t)
        target = rotation.to_matrix().to_4x4()
        wrist.rotation_mode = "QUATERNION"
        target.translation = self.rig_inverse @ position
        wrist.matrix = target
        if frame is not None:
            wrist.keyframe_insert("location", frame=frame)
            wrist.keyframe_insert("rotation_quaternion", frame=frame)
        for index, finger in enumerate(FINGERS):
            for segment in range(1, 4):
                bone = self.bones[f"finger_{finger}{segment}.{side}"]
                start = GRIPS[a.grip][index][segment - 1]
                finish = GRIPS[b.grip][index][segment - 1]
                value = math.radians(start + t * (finish - start))
                bone.rotation_mode = "QUATERNION"
                bone.rotation_quaternion = Quaternion(self.finger_axes[bone.name], value)
                if frame is not None:
                    bone.keyframe_insert("rotation_quaternion", frame=frame)
        return position, rotation

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
    left = hand("l", (-0.190, 0.39, -0.236), (0.64, 0.53, 0.55), (0.68, -0.62, -0.28), "pack")
    hidden_r = Hand(Vector((0.27, 0.21, -0.48)), right.rotation, "relax")
    hidden_l = Hand(Vector((-0.27, 0.21, -0.48)), left.rotation, "relax")
    # Положение сигареты относительно хвата измеряем по согнутым пальцам.
    animator.pose("r", right, right, 0)
    bpy.context.view_layer.update()
    bones = animator.bones
    wrist_world = animator.rig.matrix_world @ bones["wrist.r"].matrix
    contacts = [animator.rig.matrix_world @ bones[f"finger_{finger}3.r"].head.lerp(
        bones[f"finger_{finger}3.r"].tail, 0.53) for finger in ("index", "middle")]
    grip = wrist_world.inverted() @ ((contacts[0] + contacts[1]) / 2 + Vector((-0.007, 0.002, 0.009)))
    grip *= UNIT
    cigarette_basis = right.rotation.inverted() @ axes((-0.97, 0.24, 0.13))

    def held(p, q):
        return p + q @ grip, q @ cigarette_basis

    pack_rotation = Quaternion(UP, math.radians(-14))
    pack_offset = Vector((0.030, 0.088, 0.018))
    pack_basis = left.rotation.inverted() @ pack_rotation
    pack_position = left.wrist + left.rotation @ pack_offset
    pack_filter = pack_position + pack_rotation @ Vector((0.0, -0.0045, 0.033))

    def with_cigarette_at(point, axis, grip_name="smoke", marker=FILTER):
        prop_rotation = axes(axis)
        wrist_rotation = prop_rotation @ cigarette_basis.inverted()
        wrist = point - prop_rotation @ marker - wrist_rotation @ grip
        return Hand(wrist, wrist_rotation, grip_name)

    pick_q = orientation("r", (-0.88, 0.45, -0.11), (-0.35, -0.38, -1))
    reference = Hand(right.wrist, pick_q, "pinch")
    animator.pose("r", reference, reference, 0)
    bpy.context.view_layer.update()
    wrist_world = animator.rig.matrix_world @ bones["wrist.r"].matrix
    pinch = [animator.rig.matrix_world @ bones[f"finger_{finger}3.r"].tail for finger in ("index", "thumb")]
    pinch_grip = (wrist_world.inverted() @ ((pinch[0] + pinch[1]) / 2)) * UNIT
    pickup = Hand(pack_filter - pick_q @ pinch_grip, pick_q, "pinch")
    pull = Hand(pickup.wrist + Vector((0.025, 0.0, 0.061)), pick_q.slerp(right.rotation, 0.42), "pinch")
    lips = with_cigarette_at(MOUTH, (0.11, 0.97, 0.17))
    near_face = Hand(right.wrist.lerp(lips.wrist, 0.43) + Vector((0.022, 0.055, 0.025)),
                     right.rotation.slerp(lips.rotation, 0.42), "smoke")
    strike_r = Hand(Vector((0.164, 0.425, -0.198)), right.rotation, "smoke")
    ember_pos, ember_rotation = held(strike_r.wrist, strike_r.rotation)
    tip_target = ember_pos + ember_rotation @ EMBER - UP * 0.002
    lighter_orientation = Quaternion(UP, math.radians(10))
    lighter_position = tip_target - lighter_orientation @ lighter_tip
    strike_q = orientation("l", (0.66, 0.57, 0.48), (0.69, -0.63, -0.30))
    lighter_offset = Vector((0.023, 0.081, 0.015))
    strike_l = Hand(lighter_position - strike_q @ lighter_offset, strike_q, "lighter")
    lighter_basis = strike_l.rotation.inverted() @ lighter_orientation
    struck = Hand(strike_l.wrist, strike_l.rotation, "press")
    low_lighter = Hand(hidden_l.wrist, strike_l.rotation, "lighter")
    flick = Hand(right.wrist + Vector((0.012, 0.013, -0.016)), right.rotation @ Quaternion((0, 1, 0), -0.17), "tap")

    # Кадры задают общую траекторию рук и предметов. Предметы привязаны к
    # хвату численно при запекании каждого кадра, без переноса Blender bone parenting в Godot.
    def bake(name, keys, pack_on=False, cig_on=False, lighter_on=False, extracting=False):
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
                animator.key(animator.lid, Vector((0, 0.010, 0.022)), Quaternion((1, 0, 0), lid_angle), 1, frame)
                cig_p, cig_q = held(r, qr)
                pack_cig_rotation = axes((0.03, 0.03, -0.999))
                if extracting and (not cig_on or frame < 16):
                    cig_q = pack_cig_rotation
                    cig_p = pack_p + pack_q @ Vector((0.0, -0.0045, 0.033)) - cig_q @ FILTER
                elif extracting and frame < 41:
                    amount = smoothstep(max(0, frame - 25) / 16)
                    cig_q = pack_cig_rotation.slerp(cig_q, amount)
                    cig_p = r + qr @ pinch_grip.lerp(grip, amount) - cig_q @ FILTER.lerp(Vector(), amount)
                animator.key(animator.cigarette, cig_p, cig_q,
                             1 if (cig_on or (pack_on and abs(lid_angle) > 0.75)) else HIDDEN_SCALE, frame)
                animator.key(animator.lighter, l + ql @ lighter_offset, ql @ lighter_basis,
                             1 if lighter_on else HIDDEN_SCALE, frame)
                flame_on = lighter_on and 25 <= frame <= 47
                wobble = (0.90 + 0.07 * math.sin(frame * 2.1)) if flame_on else HIDDEN_SCALE
                animator.key(animator.flame, Vector((0, 0, 0.036)), Quaternion((0, 1, 0), 0.03 * math.sin(frame)), wobble, frame)
        animator.finish(name, keys[-1][0])

    lid_open = math.radians(-105)
    bake("достать_пачку", [(1, hidden_r, hidden_l, 0), (14, hidden_r, left, 0),
                           (23, hidden_r, left, lid_open), (29, hidden_r, left, lid_open)], pack_on=True, extracting=True)
    bake("покой_пачка", [(1, hidden_r, left, lid_open), (48, hidden_r, left, lid_open)], pack_on=True, extracting=True)
    bake("вынуть_сигарету", [(1, hidden_r, left, lid_open), (16, pickup, left, lid_open),
                             (25, pull, left, lid_open), (41, right, hidden_l, 0)], pack_on=True, cig_on=True, extracting=True)
    for clip in ("покой_неподожжённая", "покой_курение"):
        rest = Hand(right.wrist + Vector((0.001, 0.004, 0.003)), right.rotation, right.grip)
        bake(clip, [(1, right, hidden_l, 0), (38, rest, hidden_l, 0), (75, right, hidden_l, 0)], cig_on=True)
    bake("поджечь_сигарету", [(1, right, low_lighter, 0), (17, strike_r, strike_l, 0),
                             (25, strike_r, struck, 0), (46, strike_r, struck, 0),
                             (52, strike_r, strike_l, 0), (65, right, low_lighter, 0)], cig_on=True, lighter_on=True)
    bake("затяжка", [(1, right, hidden_l, 0), (12, near_face, hidden_l, 0), (20, lips, hidden_l, 0),
                     (33, lips, hidden_l, 0), (42, near_face, hidden_l, 0), (62, right, hidden_l, 0)], cig_on=True)
    bake("стряхнуть_пепел", [(1, right, hidden_l, 0), (12, flick, hidden_l, 0),
                             (19, right, hidden_l, 0), (30, right, hidden_l, 0)], cig_on=True)
    bake("убрать_пачку", [(1, hidden_r, left, lid_open), (16, hidden_r, hidden_l, 0)], pack_on=True, extracting=True)
    bake("убрать_сигарету", [(1, right, hidden_l, 0), (16, hidden_r, hidden_l, 0)], cig_on=True)


def main():
    output = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else ROOT / "models/руки_сигарета.glb"
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "wrad_arms.blend"))
    scene = bpy.context.scene
    scene.render.fps = FPS
    rig = bpy.data.objects["arms"]
    rig.location = (0, -0.10, -0.225)
    rig.scale = (UNIT,) * 3
    mesh = bpy.data.objects["arms_mesh"]
    if mesh.parent != rig:
        mesh.parent = rig
    soften_skin(mesh)
    # Материал рукава назначаем по весам: кожа остаётся на кисти и у запястья.
    sleeve = material("синий хлопок", (0.045, 0.057, 0.069), 0.98)
    mesh.data.materials.append(sleeve)
    sleeve_groups = {g.index for g in mesh.vertex_groups if g.name.startswith(("shoulder", "bicep", "forearm"))}
    for face in mesh.data.polygons:
        face.use_smooth = True
        weight = sum(group.weight for i in face.vertices for group in mesh.data.vertices[i].groups
                     if group.group in sleeve_groups) / len(face.vertices)
        if weight > 0.40:
            face.material_index = len(mesh.data.materials) - 1
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
                             export_frame_range=False, export_anim_slide_to_zero=True, export_cameras=False)


if __name__ == "__main__":
    main()
