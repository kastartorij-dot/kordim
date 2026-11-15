# CC0 Tree Small 02 — LOD для дальнего плана, без изменения UV листьев.
# Исходник 1k и include-файлы: assets/polyhaven/дерево-источник.json.
import bpy, bmesh, random
from mathutils import Vector
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(root/'assets/polyhaven/tree_small_02/tree_small_02.gltf'))
for ob in list(bpy.context.scene.objects):
 if ob.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True)
 bpy.context.view_layer.objects.active=ob
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
meshes=[ob for ob in bpy.context.scene.objects if ob.type=='MESH']
for ob in meshes:
 mats=[m.name.lower() for m in ob.data.materials if m]
 used={ob.data.materials[p.material_index].name.lower() for p in ob.data.polygons}
 if any('leaves' in name for name in used):
  # Коллапс на альфа-листьях рвёт UV: вместо него выбираем целые островки.
  bm=bmesh.new();bm.from_mesh(ob.data)
  remaining=set(bm.verts);remove=[];rnd=random.Random(73)
  while remaining:
   seed=remaining.pop();island=[seed];stack=[seed]
   while stack:
    v=stack.pop()
    for e in v.link_edges:
     q=e.other_vert(v)
     if q in remaining:remaining.remove(q);island.append(q);stack.append(q)
   if rnd.random()>0.04:remove.extend(island)
   else:
    # Компенсация плотности дальнего LOD: целые листья крупнее, UV не меняются.
    center=sum((v.co for v in island),Vector())/len(island)
    for v in island:v.co=center+(v.co-center)*2.3
  bmesh.ops.delete(bm,geom=remove,context='VERTS')
  bm.to_mesh(ob.data);bm.free()
 else:
  n=sum(len(p.vertices)-2 for p in ob.data.polygons)
  md=ob.modifiers.new('Distant LOD','DECIMATE');md.ratio=min(1,12000/max(1,n))
  bpy.context.view_layer.objects.active=ob
  bpy.ops.object.modifier_apply(modifier=md.name)
# Для деревьев в десятках метров достаточно 512px: экономит VRAM и размер PCK.
for image in bpy.data.images:
 if image.size[0]>512 or image.size[1]>512:
  factor=512/max(image.size)
  image.scale(max(1,int(image.size[0]*factor)),max(1,int(image.size[1]*factor)))
  image.pack()
bpy.ops.export_scene.gltf(filepath=str(root/'models/дерево.glb'),export_format='GLB',export_cameras=False,export_lights=False)
print('Tree LOD triangles:',sum(sum(len(p.vertices)-2 for p in ob.data.polygons) for ob in meshes))
