extends SceneTree
## Интеграционная проверка физики настоящей комнаты, без графического окна.
## godot --headless --path . --script Инструменты/проверка_ходьбы.gd

func _initialize() -> void:
	call_deferred("_run")

func _check(condition: bool, message: String) -> bool:
	if not condition:
		push_error(message)
		quit(1)
	return condition

func _run() -> void:
	var scene = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	var player: CharacterBody3D = scene.player
	if not _check(player != null, "Не создан игрок"): return
	for view in [1, 3]:
		scene._set_view(view)
		for i in range(40): await physics_frame
		if not _check(player.is_on_floor(), "Нет пола в ракурсе %s" % view): return
		if not _check(player.position.y > -0.05 and player.position.y < 0.10, "Игрок провалился"): return
	# Реальные обработчики ввода: клик, ходьба по W, пробел.
	scene._set_view(1)
	for i in range(15): await physics_frame
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	Input.parse_input_event(click)
	var key := InputEventKey.new()
	key.physical_keycode = KEY_W
	key.pressed = true
	Input.parse_input_event(key)
	var start := player.position
	for i in range(30): await physics_frame
	key = InputEventKey.new()
	key.physical_keycode = KEY_W
	key.pressed = false
	Input.parse_input_event(key)
	var input_test := DisplayServer.get_name() != "headless"
	if input_test and not _check(player.position.distance_to(start) > 0.4, "W не двигает игрока"): return
	key = InputEventKey.new()
	key.physical_keycode = KEY_SPACE
	key.pressed = true
	Input.parse_input_event(key)
	var highest := player.position.y
	for i in range(40):
		await physics_frame
		highest = maxf(highest, player.position.y)
	if input_test and not _check(highest > 0.25, "Пробел не запускает прыжок"): return
	if not input_test:
		print("В headless захват мыши недоступен; клавиатуру и прыжок проверять с дисплеем")
	key = InputEventKey.new()
	key.physical_keycode = KEY_SPACE
	key.pressed = false
	Input.parse_input_event(key)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	# В проходе между кроватями можно идти; сама кровать должна остановить капсулу.
	player.set_physics_process(false)
	player.position = Vector3(3.0, 0.02, -1.6)
	for i in range(60):
		await physics_frame
		player.velocity = Vector3(0, -0.2, -2)
		player.move_and_slide()
	if not _check(player.position.z > -2.5, "Кровать пропускает игрока"): return
	if not _check(player.position.z < -1.7, "Проход заблокирован при старте"): return
	# Отдельная проверка внешней стены в свободной части лоджии.
	player.position = Vector3(5.4, 0.02, -1.6)
	for i in range(60):
		await physics_frame
		player.velocity = Vector3(2, -0.2, 0)
		player.move_and_slide()
	if not _check(player.position.x < 6.1, "Игрок прошёл сквозь ограждение лоджии"): return
	player.position = Vector3(0.75, 0.02, -0.55)
	for i in range(90):
		await physics_frame
		player.velocity = Vector3(-2, -0.2, 0)
		player.move_and_slide()
	# Дальше стоит открытая дверь санузла: анимации дверей пока не реализованы.
	if not _check(player.position.x < -0.35, "Нет прохода в коридор: %s" % player.position): return
	print("Ходьба OK: полы, мебель, ограждение, вход в коридор; ввод проверен: ", input_test)
	quit()
