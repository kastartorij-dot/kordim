"""Собирает ту же комнату для осмотра в Godot, не меняя исходные модели мебели.

blender --background --python blender/экспорт.py
Процедурный рельеф Cycles пока не запекается; базовые цвета, текстуры и UV сохраняются.
"""
import os
import json
import math
from mathutils import Matrix, Vector
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
from комната import build
from мебель import ROOT

build()
# Сохраняем подвижные узлы отдельно, остальную геометрию объединяем.
# Положение петель и направления берутся из исходной иерархии Blender.
groups = []

def movable(ob, label, kind, closed, opened, axis, pivot=None, initial_open=False):
    parts = [child for child in ob.children_recursive if child.type == "MESH"]
    if ob.type == "MESH":
        parts.append(ob)
    groups.append((parts, Vector(pivot) if pivot is not None else ob.matrix_world.translation.copy(), {
        "node": "Moving_%02d" % len(groups), "label": label, "kind": kind,
        "closed": closed, "opened": opened, "axis": list(axis), "initial_open": initial_open,
    }))

bpy.context.view_layer.update()
for ob in list(bpy.context.scene.objects):
    base = ob.name.split(".")[0]
    parent = ob.parent.name.split(".")[0] if ob.parent else ""
    if ob.type == "EMPTY" and base == "полотно" and parent == "Дверь_комнаты":
        movable(ob, "Дверь в комнату", "rotate", math.radians(80), 0, (0, 1, 0), initial_open=True)
    elif base == "дверь_су":
        movable(ob, "Дверь санузла", "rotate", math.pi / 2, 0, (0, 1, 0),
                pivot=(-0.95, 1.15, 0), initial_open=True)
    elif ob.type == "EMPTY" and base.startswith("ящик"):
        axis = ob.parent.matrix_world.to_3x3() @ Vector((0, -1, 0))
        movable(ob, "Ящик · " + parent, "slide", 0, 0.28, (axis.x, axis.z, -axis.y))
    elif ob.type == "EMPTY" and parent == "Шкаф" and base.startswith("дверь_"):
        axis = ob.parent.matrix_world.to_3x3() @ Vector((1, 0, 0))
        left = base == "дверь_левая"
        movable(ob, "Створка шкафа", "slide", -0.45 if left else 0,
                0.33 if left else -0.78, (axis.x, axis.z, -axis.y), initial_open=left)
        # Исходная створка уже сдвинута на 0,45; это промежуточное положение.
        groups[-1][2]["initial_value"] = 0
    elif ob.type == "EMPTY" and parent == "Холодильник" and base.startswith("дверь_"):
        movable(ob, "Морозилка" if base == "дверь_морозилка" else "Холодильник",
                "rotate", 0, math.radians(100), (0, 1, 0))
    elif ob.type == "EMPTY" and base == "дверца" and parent == "Тумба_СВЧ":
        movable(ob, "Дверца тумбы", "rotate", 0, math.radians(95), (0, 1, 0))

# Входное полотно и вся его фурнитура движутся одним узлом.
entry_parts = [bpy.data.objects[name] for name in ("входная_дверь", "ручка_вход", "ручка_вход_накладка", "глазок")]
movable(entry_parts[0], "Входная дверь", "rotate", 0, math.radians(95), (0, 1, 0), pivot=(-2.3, 0.15, 0))
groups[-1] = (entry_parts, groups[-1][1], groups[-1][2])

balcony_parts = [ob for ob in bpy.context.scene.objects if ob.type == "MESH" and ob.name.split(".")[0] in ("рама_балк", "стекло_балк", "панель_балк", "ручка_балк")]
movable(balcony_parts[0], "Балконная дверь", "rotate", 0, -math.pi / 2, (0, 1, 0), pivot=(4.835, 3.1, 0))
groups[-1] = (balcony_parts, groups[-1][1], groups[-1][2])

meshes = [ob for ob in bpy.context.scene.objects if ob.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for ob in meshes:
    ob.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.convert(target="MESH")
# BMesh и импортированные GLTF создают слои с разными именами. При join
# Blender сохраняет их отдельно, заполняя чужие вершины нулями. Тогда glTF
# берёт UV0, а фасады и ткань читают один пиксель вместо своей текстуры.
for ob in bpy.context.selected_objects:
    layers = ob.data.uv_layers
    if not layers:
        continue
    active = next((layer for layer in layers if layer.active_render), layers.active)
    for layer in list(layers):
        if layer != active:
            layers.remove(layer)
    layers[0].name = "UVMap"
    layers.active_index = 0
    layers[0].active_render = True
def merge(parts, name, pivot):
    bpy.ops.object.select_all(action="DESELECT")
    for ob in parts:
        world = ob.matrix_world.copy()
        ob.parent = None
        ob.matrix_world = world
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.data.transform(Matrix.Translation(-pivot) @ result.matrix_world)
    result.matrix_world = Matrix.Translation(pivot)
    result.name = name
    return result

curtains = [(bpy.data.objects["штора_1"], Vector((4.48, 0, 0))),
            (bpy.data.objects["штора_2"], Vector((4.48, 3.2, 0)))]
moving_parts = {ob for parts, _, _ in groups for ob in parts} | {ob for ob, _ in curtains}
exported = [merge([ob for ob in meshes if ob not in moving_parts], "Общага", Vector((0, 0, 0)))]
for parts, pivot, spec in groups:
    exported.append(merge(parts, spec["node"], pivot))
for i, (ob, pivot) in enumerate(curtains):
    exported.append(merge([ob], "Curtain_%s" % i, pivot))
bpy.ops.object.select_all(action="DESELECT")
for ob in exported:
    ob.select_set(True)
# glTF Transmission рассчитан на трассировку. В первой версии Godot применяем
# обычное прозрачное стекло; иначе окна становятся непрозрачными белыми пластинами.
for material in {mat for ob in exported for mat in ob.data.materials}:
    if not material or not material.use_nodes:
        continue
    bsdf = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf and bsdf.inputs["Transmission Weight"].default_value > 0.5:
        bsdf.inputs["Transmission Weight"].default_value = 0
        bsdf.inputs["Alpha"].default_value = 0.14 if bsdf.inputs["Roughness"].default_value < 0.1 else 0.35
        material.surface_render_method = "DITHERED"

path = os.path.join(ROOT, "models", "общага.glb")
bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True,
                          export_cameras=False, export_lights=False,
                          export_yup=True, export_materials="EXPORT")
print("Godot:", path)

with open(os.path.join(ROOT, "models", "подвижные.json"), "w", encoding="utf-8") as f:
    json.dump([spec for _, _, spec in groups], f, ensure_ascii=False, indent=2)
    f.write("\n")
print("Подвижных узлов:", len(groups))
