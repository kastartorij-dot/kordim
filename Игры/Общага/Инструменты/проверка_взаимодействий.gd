extends SceneTree
## Проверяет настоящую GLB: подвижные коллизии, доступность и проход по коридору.

func _initialize() -> void:
	call_deferred("_run")

func _check(ok: bool, message: String) -> bool:
	if not ok:
		push_error(message)
		quit(1)
	return ok

func _settle(item: Node3D) -> void:
	for i in range(150):
		await physics_frame
		if not item.moving: return

func _walk(player: CharacterBody3D, direction: Vector3, frames: int) -> void:
	for i in range(frames):
		await physics_frame
		player.velocity = direction * 1.8 + Vector3(0, -0.2, 0)
		player.move_and_slide()

func _run() -> void:
	var scene = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	var player: CharacterBody3D = scene.player
	player.set_physics_process(false)
	player.position = Vector3(5.4, 0.03, -1.6)
	await physics_frame
	await physics_frame
	if not _check(scene.interactables.size() == 19, "Ожидались 19 подвижных узлов"): return
	var room_door: Node3D
	var bathroom_door: Node3D
	var drawer: Node3D
	var sash: Node3D
	for item in scene.interactables:
		if item.spec.label == "Дверь в комнату": room_door = item
		if item.spec.label == "Дверь санузла": bathroom_door = item
		if item.spec.label == "Ящик · Комод": drawer = item
		if item.spec.label == "Левая створка лоджии": sash = item
		var original: Transform3D = item.transform
		item.toggle()
		await _settle(item)
		if not _check(not item.blocked and not item.moving, "Не завершён ход: " + item.spec.label): return
		if item == sash and not _check(item.position.z > original.origin.z and is_equal_approx(item.position.x, original.origin.x), "Левая створка должна сдвигаться вправо по направляющей"): return
		var expected: float = item.spec.opened if item.opened else item.spec.closed
		if not _check(is_equal_approx(item.value, expected), "Не достигнута конечная поза"): return
		if not _check(not item.transform.is_equal_approx(original), "Меш не движется"): return
		item.toggle()
		await _settle(item)
		if item.spec.has("initial_value"): continue # шкаф первоначально приоткрыт, возврат до упора
		if not _check(item.transform.is_equal_approx(original), "Нет возврата в исходную позу"): return
	if not _check(sash != null, "Не найдена левая створка лоджии"): return
	player.position = Vector3(5.78, 0.03, -2.85)
	await physics_frame
	await physics_frame
	scene.camera.look_at(sash.global_transform * sash.collision.shape.get_debug_mesh().get_aabb().get_center())
	if not _check(scene._interaction_target() == sash, "Луч не выбирает створку с лоджии"): return
	# Закрытая комнатная дверь блокирует проход; открытая пропускает.
	room_door.toggle()
	await _settle(room_door)
	player.position = Vector3(0.75, 0.03, -0.55)
	await physics_frame
	await physics_frame
	await _walk(player, Vector3.LEFT, 55)
	if not _check(player.position.x > 0.15, "Закрытая дверь пропускает игрока"): return
	player.position = Vector3(1.2, 0.03, -0.55)
	await physics_frame
	await physics_frame
	room_door.toggle()
	await _settle(room_door)
	if not _check(not room_door.blocked, "Открывание двери остановлено игроком"): return
	# Дверь санузла в открытой позе перекрывает коридор; закрываем её.
	bathroom_door.toggle()
	await _settle(bathroom_door)
	player.position = Vector3(0.75, 0.03, -0.55)
	await physics_frame
	await physics_frame
	await _walk(player, Vector3.LEFT, 95)
	if not _check(player.position.x < -1.8, "Нельзя пройти весь коридор: %s" % player.position): return
	await _walk(player, Vector3.RIGHT, 95)
	if not _check(player.position.x > 0.4, "Нет обратного прохода из коридора"): return
	# Луч должен видеть ближайшую створку и учитывать стену/дальность.
	player.position = Vector3(0.45, 0.03, -0.55)
	await physics_frame
	await physics_frame
	scene.camera.look_at(Vector3(0.6, 1.0, -0.15))
	await physics_frame
	if not _check(scene._interaction_target() == room_door, "Не выбирается открытая комнатная дверь"): return
	player.position = Vector3(3.0, 0.03, -0.55)
	await physics_frame
	await physics_frame
	scene.camera.look_at(Vector3(0.6, 1.0, -0.15))
	if not _check(scene._interaction_target() == null, "Дверь доступна за пределами 2 м"): return
	# Ящик не проходит через стоящую перед ним капсулу.
	player.position = drawer.global_transform * drawer.collision.shape.get_debug_mesh().get_aabb().get_center()
	await physics_frame
	await physics_frame
	player.position += Vector3(drawer.spec.axis[0], drawer.spec.axis[1], drawer.spec.axis[2]) * 0.45
	player.position.y = 0.02
	await physics_frame
	drawer.toggle()
	await _settle(drawer)
	if not _check(drawer.blocked and drawer.value > 0 and drawer.value < drawer.spec.opened, "Ящик не остановился перед игроком"): return
	# Новый порожек и облицовка не должны сужать проход в санузел.
	# Подходим сбоку, вне сектора движения полотна.
	player.position = Vector3(-0.08, 0.015, -0.78)
	await physics_frame
	await physics_frame
	if not bathroom_door.opened:
		bathroom_door.toggle()
		await _settle(bathroom_door)
	if not _check(bathroom_door.opened and not bathroom_door.blocked and not bathroom_door.moving, "Не открылась дверь санузла"): return
	player.position = Vector3(-0.59, 0.015, -0.86)
	await physics_frame
	await physics_frame
	await _walk(player, Vector3.FORWARD, 27)
	if not _check(player.position.z < -1.55, "Игрок застрял на пороге санузла"): return
	await _walk(player, Vector3.BACK, 27)
	if not _check(player.position.z > -0.95, "Игрок застрял при выходе из санузла"): return
	print("Взаимодействия OK: 19 узлов, оба положения, коллизии дверей, коридор туда/обратно, луч, защита игрока, порог санузла")
	quit()
