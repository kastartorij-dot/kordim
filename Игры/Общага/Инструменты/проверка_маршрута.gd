extends SceneTree
func _initialize(): call_deferred("run")
func travel(p: CharacterBody3D, target: Vector3) -> bool:
 for i in range(240):
  await physics_frame
  var offset:=target-p.position
  offset.y=0
  if offset.length()<0.06: return true
  p.velocity=offset.normalized()*1.6+Vector3(0,-0.25,0)
  p.move_and_slide()
 push_error("Маршрут заблокирован: %s → %s" % [p.position,target])
 return false
func run():
 var s=load("res://scenes/dorm.tscn").instantiate()
 root.add_child(s)
 await physics_frame
 var p: CharacterBody3D=s.player
 p.set_physics_process(false)
 p.position=Vector3(0.75,0.03,-0.63)
 await physics_frame
 for item in s.interactables:
  if item.spec.label=="Дверь санузла" and item.opened: item.toggle()
  if item.spec.label in ["Входная дверь","Балконная дверь"] and not item.opened: item.toggle()
 for i in range(150): await physics_frame
 for item in s.interactables:
  if item.spec.label in ["Входная дверь","Балконная дверь"]:
   if item.blocked or not item.opened:
    push_error("Дверь не открыта: "+item.spec.label);quit(1);return
 # Один старт. Дальше весь маршрут капсулой, без смены ракурса/телепортации.
 for at in [Vector3(-3.0,0,-0.63),Vector3(0.7,0,-0.63),Vector3(0.7,0,-0.96),Vector3(1.05,0,-1.6),Vector3(3.72,0,-1.6),Vector3(3.72,0,-2.0),Vector3(4.76,0,-2.0),Vector3(4.76,0,-2.15),Vector3(5.75,0,-2.15),Vector3(4.76,0,-2.15),Vector3(4.76,0,-2.0),Vector3(3.72,0,-2.0),Vector3(3.72,0,-1.6),Vector3(1.05,0,-1.6)]:
  if not await travel(p,at): quit(1);return
 print("Маршрут OK: площадка → коридор → комната → лоджия → комната без телепортации")
 quit()
