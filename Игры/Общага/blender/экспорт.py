"""Собирает ту же комнату для осмотра в Godot, не меняя исходные модели мебели.

blender --background --python blender/экспорт.py
Процедурный рельеф Cycles пока не запекается; базовые цвета, текстуры и UV сохраняются.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy
from комната import build
from мебель import ROOT

build()
# Снимок статической сборки. Подвижные части остаются в исходных models/*.glb;
# для интерактивной версии потребуется отдельная сборка этих объектов.
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
bpy.ops.object.join()
room = bpy.context.object
room.name = "Общага"
# glTF Transmission рассчитан на трассировку. В первой версии Godot применяем
# обычное прозрачное стекло; иначе окна становятся непрозрачными белыми пластинами.
for material in room.data.materials:
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
