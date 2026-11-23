extends SceneTree
## Регрессия трёх режимов света и двух опциональных дневных прототипов.
## Запуск без флагов, с --daylight-prototype и с --daylight-prototype-v2.

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
	var args := OS.get_cmdline_user_args()
	var v2 := args.has("--daylight-prototype-v2")
	var v1 := v2 or args.has("--daylight-prototype")
	if not _check(scene.daylight.size() == 5, "Изменилось количество дневных источников"): return
	if not _check(scene.daylight_prototype == v1 and scene.daylight_prototype_v2 == v2, "Неверно прочитаны флаги"): return
	for i in [1, 2]:
		if not _check((scene.daylight[i] is SpotLight3D) == v2, "Неверный тип источника у окна %d" % i): return
		if v2:
			if not _check(not scene.daylight[i].shadow_enabled, "Рассеянный свет не должен создавать жёсткие тени"): return
			if not _check(is_zero_approx(scene.daylight[i].light_specular), "У пробного света есть зеркальный блик"): return
	var expected_day_ambient := 0.18 if v1 else 0.28
	for mode in range(3):
		scene._set_lighting(mode)
		if not _check(scene.lighting_mode == mode, "Не переключился режим %d" % mode): return
		if not _check(scene.room_environment.background_mode == Environment.BG_SKY
				and scene.sky_material.get_shader_parameter("lighting_mode") == mode,
				"Небо не переключилось вместе со светом"): return
		for light in scene.daylight:
			if not _check(light.visible == (mode == 0), "Дневной источник активен не в своём режиме"): return
		if not _check(scene.ceiling_light.visible == (mode == 1), "Неверное состояние потолочного света"): return
		if not _check(scene.bedside_light.visible == (mode == 2), "Неверное состояние ночника"): return
		var ambient: float = [expected_day_ambient, 0.08, 0.015][mode]
		if not _check(is_equal_approx(scene.room_environment.ambient_light_energy, ambient), "Неверная фоновая освещённость"): return
	var sun: Light3D = scene.daylight[0]
	var window_light: Light3D = scene.daylight[1]
	var window_shadow := window_light.shadow_enabled
	scene._set_fast_lights(true)
	if not _check(sun.shadow_enabled and scene.ceiling_light.shadow_enabled, "Потеряны основные тени"): return
	if not _check(not window_light.shadow_enabled and not scene.bedside_light.shadow_enabled, "Остались дополнительные тени"): return
	scene._set_fast_lights(false)
	if not _check(window_light.shadow_enabled == window_shadow and scene.bedside_light.shadow_enabled, "Дополнительные тени не восстановились"): return
	if not _check(scene.asgard_day.size() == 2, "В БЦ Асгард отсутствуют материалы фасада"): return
	for material in scene.asgard_day:
		if not _check(material.emission_enabled, "Нет ночной подсветки фасада"): return
	scene._set_lighting(0)
	for material in scene.asgard_day:
		if not _check(not material.emission_enabled, "Ночной фасад остался днём"): return
	print("Свет OK: день/вечер/ночь; прототип v2=", v2, ", старый прототип=", v1)
	quit()
