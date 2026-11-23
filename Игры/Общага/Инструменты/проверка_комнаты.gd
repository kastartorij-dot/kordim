extends SceneTree

const TEST_SAVE := "user://controls-test.cfg"

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, message: String) -> bool:
	if not ok:
		push_error(message)
		quit(1)
	return ok

func _run() -> void:
	var scene = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	scene.player.set_physics_process(false)
	if not _check(scene.room_controls.size() == 8, "Изменилось число органов управления"): return
	var switch: Area3D
	for control in scene.room_controls:
		match control.kind:
			"curtain":
				if not _check(control.cloth != null, "Нет полотна шторы"): return
				control.set_closed(true, true)
				if not _check(is_equal_approx(control.cloth.scale.z, 1.0), "Штора не закрылась"): return
			"light":
				switch = control
			"lamp":
				control.toggle()
				if not _check(scene.lamp_menu.visible, "Ночник не открыл меню"): return
	if not _check(switch != null, "Нет выключателя"): return

	# Подходим к выключателю со стороны стола. За полотном двери луч обязан
	# выбирать дверь, поэтому проверяем из свободного сектора у выключателя.
	scene.camera.global_position = switch.global_position + Vector3(0.09, 0, -0.23)
	scene.camera.look_at(switch.global_position)
	var target = scene._interaction_target()
	if not _check(target == switch, "Луч не выбирает выключатель"): return
	scene._set_lighting(2)
	target.toggle()
	if not _check(scene.ceiling_light.visible and scene.lighting_mode == 2, "Выключатель должен менять только главный свет"): return
	if not _check(scene.save_walk(TEST_SAVE) == OK, "Состояние комнаты не сохранилось"): return
	scene._set_lighting(0)
	for control in scene.room_controls:
		if control.kind == "curtain": control.set_closed(false, true)
	if not _check(scene.load_walk(TEST_SAVE) == OK, "Состояние комнаты не загрузилось"): return
	if not _check(scene.lighting_mode == 2 and scene.ceiling_light.visible, "Свет не восстановился"): return
	for control in scene.room_controls:
		if control.kind == "curtain" and not _check(control.closed and is_equal_approx(control.cloth.scale.z, 1.0), "Штора не восстановилась"): return
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_SAVE))
	print("Комната OK: выключатель, ночник, две шторы, сохранение света и штор")
	quit()
