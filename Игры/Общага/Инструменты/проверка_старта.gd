extends SceneTree
## После F5/F6 игрок должен стоять в свободном проходе и двигаться без выбора 2/3/4.
## godot --headless --path . --script Инструменты/проверка_старта.gd

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
	await physics_frame
	var p: CharacterBody3D = scene.player
	if not _check(p != null, "Не создан игрок при обычном запуске"): return
	if not _check(p.camera == scene.camera, "Камера не привязана к игроку"): return
	if not _check(p.position.x > 0.95 and p.position.x < 3.2 and absf(p.position.z + 1.6) < 0.1, "Начальный ракурс не находится в проходе: %s" % p.position): return
	if not _check(p.can_stand_at(p.global_transform), "Стартовая капсула пересекает мебель или стену: %s" % p.position): return
	if DisplayServer.get_name() != "headless":
		if not _check(Input.mouse_mode == Input.MOUSE_MODE_CAPTURED, "При старте не захвачена мышь: WASD останется выключен"): return
	# Проверяем сам проход по физике, без вызова _set_view(2..4).
	p.set_physics_process(false)
	var before: Vector3 = p.position
	for i in range(35):
		await physics_frame
		p.velocity = Vector3(1.6, -0.25, 0)
		p.move_and_slide()
	if not _check(p.position.x > before.x + 0.25, "Из начальной точки нельзя идти вперёд по проходу: %s -> %s" % [before, p.position]): return
	print("Старт OK: свободная точка, движение без 2/3/4, захват мыши (графический режим)")
	quit()
