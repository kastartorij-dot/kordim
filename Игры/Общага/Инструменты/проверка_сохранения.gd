extends SceneTree

const TEST_SAVE := "user://walk-test.cfg"
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
	scene.player.position = Vector3(5.35, 0.03, -1.6)
	scene.camera.rotation.x = -0.25
	for item in scene.interactables:
		item.toggle()
	for i in range(150): await physics_frame
	var poses: Array[Transform3D] = []
	var flags: Array[bool] = []
	for item in scene.interactables:
		poses.append(item.transform)
		flags.append(item.is_open)
	var player_pose: Transform3D = scene.player.transform
	if not _check(scene.save_walk(TEST_SAVE) == OK, "Не удалось записать сохранение"): return
	for item in scene.interactables: item.toggle()
	scene._set_view(1)
	for i in range(150): await physics_frame
	if not _check(scene.load_walk(TEST_SAVE) == OK, "Не удалось загрузить сохранение"): return
	if not _check(scene.player.transform.is_equal_approx(player_pose), "Не восстановлена позиция/ориентация игрока"): return
	if not _check(is_equal_approx(scene.camera.rotation.x, -0.25), "Не восстановлен наклон камеры"): return
	for i in scene.interactables.size():
		var item = scene.interactables[i]
		if not _check(item.transform.is_equal_approx(poses[i]) and item.is_open == flags[i] and not item.moving, "Не восстановлено состояние узла %s" % i): return
	# Загрузка несуществующего или неполного файла не меняет сцену.
	if not _check(scene.load_walk("user://missing-dorm-save.cfg") == ERR_FILE_NOT_FOUND, "Нет корректной обработки отсутствующего файла"): return
	var invalid := ConfigFile.new()
	invalid.set_value("walk", "version", 1)
	invalid.save(TEST_SAVE)
	if not _check(scene.load_walk(TEST_SAVE) == ERR_INVALID_DATA, "Принято неполное сохранение"): return
	if not _check(scene.player.transform.is_equal_approx(player_pose), "Повреждённый файл изменил игрока"): return
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_SAVE))
	print("Сохранение OK: игрок, камера, 18 состояний COGITO, отсутствующий/неполный файл")
	quit()
