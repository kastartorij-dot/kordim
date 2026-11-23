"""Экспорт висящего пиджака в GLB. Запускать Blender с открытым исходником ideal-physics."""
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
scene.frame_set(1)
bpy.ops.object.select_all(action="DESELECT")

jacket = bpy.data.objects["Пиджак Горного университета"]
hanger = bpy.data.objects["Плечики"]
hook = bpy.data.objects["Крючок плечиков"]

# Сохраняем исходную висящую форму. Симуляция падения остаётся в .blend.
for modifier in list(jacket.modifiers):
    if modifier.type == "CLOTH":
        jacket.modifiers.remove(modifier)

for part in (hanger, hook):
    bpy.ops.object.select_all(action="DESELECT")
    part.select_set(True)
    bpy.context.view_layer.objects.active = part
    bpy.ops.object.convert(target="MESH")
bpy.ops.object.select_all(action="DESELECT")
for name in ("Пиджак Горного университета", "Плечики", "Крючок плечиков"):
    bpy.data.objects[name].select_set(True)
bpy.context.view_layer.objects.active = jacket

bpy.ops.export_scene.gltf(
    filepath=str(ROOT / "models" / "пиджак.glb"),
    export_format="GLB",
    use_selection=True,
    export_cameras=False,
    export_lights=False,
)
