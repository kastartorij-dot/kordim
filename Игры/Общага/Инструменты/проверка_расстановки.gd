extends SceneTree

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var dorm := preload("res://scenes/dorm.tscn").instantiate()
	var model := dorm.get_node("Модель")
	var fridge := model.get_node("Холодильник") as Node3D
	var chair := model.get_node("Стул у стола") as Node3D
	var shift := Vector3(-0.12, 0.0, 0.16)
	var door := fridge.get_child(0) as MeshInstance3D
	var original_door_position := door.position
	fridge.position += shift
	chair.position -= shift
	root.add_child(dorm)
	await physics_frame

	var checked_doors := 0
	for item in dorm.interactables:
		if item.get_parent() != fridge: continue
		assert(item.global_position.is_equal_approx(fridge.to_global(item.position)))
		if door.get_parent() == item:
			assert(item.position.is_equal_approx(original_door_position))
		checked_doors += 1
	assert(checked_doors == 2)
	var rest_area: Area3D = dorm.room_controls[0]
	assert(rest_area.global_position.is_equal_approx(chair.to_global(Vector3(0, 0.45, 0))))
	# Твёрдая боковина должна быть там же, где и сдвинутая видимая модель.
	var side_point := fridge.to_global(Vector3(-0.26, 0.75, 0.3))
	var ray := PhysicsRayQueryParameters3D.create(side_point - Vector3(0.09, 0, 0),
			side_point + Vector3(0.09, 0, 0), 1)
	var hit: Dictionary = dorm.get_world_3d().direct_space_state.intersect_ray(ray)
	assert(not hit.is_empty() and absf(hit.position.x - side_point.x) < 0.03)
	print("Расстановка OK: дверцы, коллизия и область отдыха следуют за мебелью")
	quit()
