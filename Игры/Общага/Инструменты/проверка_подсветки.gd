extends SceneTree

const TEST_SAVE := "user://accent-test.cfg"

func _initialize() -> void:
	call_deferred("run")

func check(ok: bool, message: String) -> bool:
	if not ok:
		push_error(message)
		quit(1)
	return ok

func key(code: Key, echo := false) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = code
	event.pressed = true
	event.echo = echo
	root.push_input(event, true)

func run() -> void:
	var scene = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(scene)
	await physics_frame
	scene.player.set_physics_process(false)
	if not check(scene.light_materials.size() == 3, "Не найдены материалы лампы и двух лент в GLB"): return
	var lamp: StandardMaterial3D = scene.light_materials["ночник"]
	if not check(not lamp.emission_enabled and not scene.bedside_light.visible, "Днём ночник должен быть выключен"): return
	for material in scene.light_materials.values():
		if not check(not material.emission_enabled, "Ленты не должны постоянно светиться в дневном режиме"): return
	scene._set_lighting(2)
	if not check(lamp.emission_enabled and scene.bedside_light.visible, "Ночью должен светиться и рассеиватель"): return
	key(KEY_N)
	await process_frame
	if not check(scene.lamp_color == 1 and scene.bedside_light.light_color.g > 0.9 and lamp.emission.g > 0.9, "N не переключает ночник в зелёный"): return
	key(KEY_N, true)
	await process_frame
	if not check(scene.lamp_color == 1, "Автоповтор не должен перебирать цвета"): return
	key(KEY_B)
	await process_frame
	if not check(scene.strip_mode == 1 and scene.light_materials["лента_стол"].emission_enabled, "B не включает подсветку"): return
	for light in scene.strip_lights:
		if not check(light.visible and light.light_color.r > 0.9 and light.omni_range < 1.5 and light.shadow_enabled, "Подсветка должна быть локальной и давать тени"): return
	if not check(scene.save_walk(TEST_SAVE) == OK, "Не записано сохранение подсветки"): return
	key(KEY_B)
	key(KEY_N)
	await process_frame
	if not check(scene.strip_mode == 2 and scene.lamp_color == 2, "Не включены фиолетовая лента и тёплый ночник"): return
	scene._set_lighting(0)
	if not check(not lamp.emission_enabled and scene.light_materials["лента"].emission_enabled, "Ленты должны работать независимо от основного света"): return
	if not check(scene.load_walk(TEST_SAVE) == OK and scene.lamp_color == 1 and scene.strip_mode == 1 and scene.lighting_mode == 2, "F9 не восстанавливает цвета и режим"): return
	if not check(lamp.emission.g > 0.9 and scene.strip_lights[0].light_color.r > 0.9, "После загрузки не обновлены материалы/источники"): return
	# Повреждённое новое поле не меняет даже уже проверенный основной свет.
	var saved := ConfigFile.new()
	saved.load(TEST_SAVE)
	saved.set_value("walk", "lighting", 0)
	saved.set_value("walk", "strip_mode", 99)
	saved.save(TEST_SAVE)
	if not check(scene.load_walk(TEST_SAVE) == ERR_INVALID_DATA and scene.lighting_mode == 2 and scene.lamp_color == 1 and scene.strip_mode == 1, "Повреждённый файл частично изменил свет"): return
	# Сохранение до появления новых цветов загружается с розовым ночником и без лент.
	saved.erase_section_key("walk", "lamp_color")
	saved.erase_section_key("walk", "strip_mode")
	saved.set_value("walk", "lighting", 2)
	saved.save(TEST_SAVE)
	if not check(scene.load_walk(TEST_SAVE) == OK and scene.lamp_color == 0 and scene.strip_mode == 0, "Нарушена совместимость старых сохранений"): return
	# Материалы импортированного ресурса не должны меняться вместе с экземпляром.
	var pristine = load("res://models/общага.glb").instantiate()
	for mesh in pristine.find_children("*", "MeshInstance3D", true, false):
		for surface in mesh.mesh.get_surface_count():
			var material := mesh.get_active_material(surface) as StandardMaterial3D
			if material != null and material.resource_name == "ночник":
				if not check(not material.emission_enabled, "Изменён общий импортированный материал ночника"): return
	pristine.free()
	DirAccess.remove_absolute(ProjectSettings.globalize_path(TEST_SAVE))
	print("Подсветка OK: N/B через ввод, локальные источники, материалы, сохранение цветов, старый/повреждённый файл")
	quit()
