extends SceneTree
func _initialize(): call_deferred("run")
func run():
 var s=load("res://scenes/dorm.tscn").instantiate()
 root.add_child(s)
 await physics_frame
 s.player.set_physics_process(false)
 assert(s.room_controls.size()==8)
 for control in s.room_controls:
  if control.kind=="curtain":
   assert(control.cloth!=null)
   control.set_closed(true,true)
   assert(is_equal_approx(control.cloth.scale.z,2.25))
  elif control.kind in ["light","lamp"]: control.toggle()
 # Луч на выключатель: сначала убираем полотно из его сектора обзора.
 s.player.position=Vector3(5.4,0.03,-1.6)
 for item in s.interactables:
  if item.spec.label=="Дверь в комнату" and item.opened: item.toggle()
 for i in range(100): await physics_frame
 s.camera.global_position=Vector3(0.34,1.09,-0.8)
 s.camera.look_at(Vector3(0.34,1.09,0))
 var target=s._interaction_target()
 assert(target!=null and target.kind=="light")
 s._set_lighting(2)
 assert(s.save_walk("user://controls-test.cfg")==OK)
 s._set_lighting(0)
 for c in s.room_controls:
  if c.kind=="curtain": c.set_closed(false,true)
 assert(s.load_walk("user://controls-test.cfg")==OK)
 assert(s.lighting_mode==2)
 for c in s.room_controls:
  if c.kind=="curtain": assert(c.closed and c.cloth.scale.z>2)
 DirAccess.remove_absolute(ProjectSettings.globalize_path("user://controls-test.cfg"))
 print("Комната OK: выключатель, ночник, две шторы, сохранение света и штор")
 quit()
