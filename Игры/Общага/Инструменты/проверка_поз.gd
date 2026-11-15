extends SceneTree
func _initialize():call_deferred("run")
func run():
 var s=load("res://scenes/dorm.tscn").instantiate()
 root.add_child(s)
 await physics_frame
 var p:CharacterBody3D=s.player
 p.set_physics_process(false)
 p.position=Vector3(3,0.03,-1.6)
 assert(p.set_crouched(true))
 assert(is_equal_approx(p.body_shape.shape.height,1.05))
 var ceiling=StaticBody3D.new()
 var shape=CollisionShape3D.new()
 var box=BoxShape3D.new();box.size=Vector3(1,0.1,1)
 shape.shape=box;ceiling.add_child(shape);s.add_child(ceiling)
 ceiling.position=Vector3(3,1.4,-1.6)
 await physics_frame
 await physics_frame
 assert(not p.set_crouched(false))
 ceiling.queue_free()
 await physics_frame
 await physics_frame
 assert(p.set_crouched(false))
 var count=0
 for c in s.room_controls:
  if c.kind not in ["chair","bed"]:continue
  s.camera.global_position=Vector3(c.global_position.x,1.6,-1.6)
  s.camera.look_at(c.global_position)
  await physics_frame
  assert(s._interaction_target()==c)
  var before:Transform3D=p.transform
  c.toggle()
  await physics_frame
  assert(p.resting==c.kind)
  assert(is_equal_approx(s.camera.position.y,1.12 if c.kind=="chair" else 0.72))
  assert(p.leave_rest())
  await physics_frame
  assert(p.resting.is_empty() and not p.body_shape.disabled)
  assert(p.transform.is_equal_approx(before))
  count+=1
 assert(count==4)
 # Занятое место выхода: остаёмся сидеть, а не телепортируемся в препятствие.
 var chair=s.room_controls[0]
 chair.toggle();await physics_frame
 var blocker=StaticBody3D.new();var cs=CollisionShape3D.new();var b=BoxShape3D.new()
 b.size=Vector3(0.5,1.6,0.5);cs.shape=b;blocker.add_child(cs);s.add_child(blocker)
 blocker.position=Vector3(3,0.85,-1.6)
 await physics_frame
 await physics_frame
 assert(not p.leave_rest())
 blocker.queue_free();await physics_frame;await physics_frame
 assert(p.leave_rest())
 print("Позы OK: Ctrl, потолок, 2 стула, 2 кровати, безопасное вставание")
 quit()
