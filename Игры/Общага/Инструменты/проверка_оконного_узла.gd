extends SceneTree

func _initialize() -> void:
 call_deferred("run")

func check(ok: bool, message: String) -> bool:
 if not ok:
  push_error(message)
  quit(1)
 return ok

func run() -> void:
 var scene = load("res://scenes/dorm.tscn").instantiate()
 root.add_child(scene)
 await physics_frame
 scene.player.set_physics_process(false)
 # Закрытая и собранная ткань остаётся за торцами обеих кроватей.
 for control in scene.room_controls:
  if control.kind != "curtain": continue
  for closed in [true, false]:
   control.set_closed(closed, true)
   var mesh := control.cloth as MeshInstance3D
   var bounds: AABB = mesh.global_transform * mesh.get_aabb()
   if not check(bounds.position.x > 4.45, "Штора перекрывает щит кровати"): return
   if not check(bounds.end.x < 4.52, "Подоконник прорезает ткань"): return
   if not check(bounds.size.z > (1.5 if closed else 0.25) and bounds.size.z < (1.8 if closed else 0.35), "Неверная ширина ткани"): return
 # На всём ходе дверь не заходит в изголовье, а не только в конечных позах.
 var door: Node3D
 for item in scene.interactables:
  if item.spec.label == "Балконная дверь": door = item
 if not check(door != null and door.position.x > 5.2, "Дверь не утоплена в проём"): return
 var shape: Shape3D = door.collision.shape
 for angle in range(91):
  var pose: Transform3D = door.base_transform * door._offset(deg_to_rad(-angle))
  # ConvexPolygonShape3D использует координаты подвижного узла.
  for point in (shape as ConvexPolygonShape3D).points:
   if not check((pose * point).x > 4.45, "Полотно пересекает кровать"): return
 # Подоконник и поднятый порог существуют как отдельные поверхности.
 var space: PhysicsDirectSpaceState3D = scene.get_world_3d().direct_space_state
 for entry in [[Vector3(4.9, 1.2, -1.3), 0.85], [Vector3(5.1, 0.6, -2.15), 0.10]]:
  var origin: Vector3 = entry[0]
  var ray := PhysicsRayQueryParameters3D.create(origin, origin - Vector3(0, 0.7, 0), 1)
  var hit: Dictionary = space.intersect_ray(ray)
  if not check(not hit.is_empty() and absf(hit.position.y - entry[1]) < 0.015, "Нет отдельного подоконника/порога"): return
 print("Оконный узел OK: шторы за щитами, глубина проёма, ход двери, отдельный подоконник/порог")
 quit()
