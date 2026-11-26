extends Node3D
## Осмотр существующей Blender-сборки. Координаты Blender (x,y,z) → Godot (x,z,-y).

var camera: Camera3D
var smoking: Node3D
var hint: Label
var help_button: Button
var winter_button: Button
var garland_button: Button
var winter_controller: Node3D
var garland_menu: Control
var trees: Array[Node3D] = []
var lighting_mode := 0
var daylight_prototype := false
var daylight_prototype_v2 := false # Флаг для сравнения, пока не вариант по умолчанию.
var room_environment: Environment
var sky_material: ShaderMaterial
var daylight: Array[Light3D] = []
var ceiling_light: OmniLight3D
var bedside_light: OmniLight3D
var lamp_color := 0
var lamp_brightness := 1.0
var lamp_on := false
var lamp_preview := -1
var lamp_menu: Control
var strip_mode := 0
var strip_lights: Array[OmniLight3D] = []
var light_materials := {}
var evening_window_light: SpotLight3D
var courtyard_lights: Array[SpotLight3D] = []
var courtyard_diffusers: Array[MeshInstance3D] = []
var monitor_light: OmniLight3D
const LAMP_COLORS := [Color(1.0, 0.12, 0.65), Color(0.22, 1.0, 0.35), Color(1.0, 0.73, 0.42), Color(0.25, 0.53, 1), Color(0.63, 0.32, 1), Color.WHITE]
const LAMP_NAMES := ["Розовый", "Зелёный", "Тёплый", "Голубой", "Сиреневый", "Белый"]
const STRIP_COLORS := [Color.BLACK, Color(1.0, 0.025, 0.08), Color(0.42, 0.08, 1.0)]
const STRIP_NAMES := ["выключена", "красная", "фиолетовая"]
var shot_path := ""
var shot_frames := 30
var preset := 1
var player: CharacterBody3D
var walk_enabled := true
var interaction_hint: Label
var interactables: Array[Node3D] = []
var status_hint: Label
var status_time := 0.0
var room_controls: Array[Area3D] = []
var loaded_room: Node3D
var fast_lights := false
var courtyard_path: MeshInstance3D
var original_shadows: Dictionary[Light3D, bool] = {}
var asgard_day: Dictionary[StandardMaterial3D, Texture2D] = {}
var asgard_night: Dictionary[StandardMaterial3D, Texture2D] = {}
var interaction_ray := PhysicsRayQueryParameters3D.new()
const ASGARD_NIGHT_TEXTURES := {
 "асгард_витраж": preload("res://textures/фасад_асгард_стекло_вечер.png"),
 "асгард_вентфасад": preload("res://textures/фасад_асгард_стена_вечер.png"),
}
const ASGARD_EMISSION_TEXTURES := {
 "асгард_витраж": preload("res://textures/фасад_асгард_стекло_свечение.png"),
 "асгард_вентфасад": preload("res://textures/фасад_асгард_стена_свечение.png"),
}
const SAVE_PATH := "user://walk.cfg"

const VIEWS := [
	[Vector3(0.75, 1.62, -1.6), Vector3(4.6, 1.3, -1.6)],
	[Vector3(4.0, 0.95, -1.85), Vector3(0, 1.2, -0.25)],
	[Vector3(5.35, 1.62, -0.9), Vector3(35, 1.62, -0.9)],
	[Vector3(0.85, 1.62, -0.65), Vector3(0.5, 1.05, -0.23)],
	[Vector3(4.42, 1.70, -1.02), Vector3(26.8, 0.0, -0.35)],
	[Vector3(6.15, 1.62, -1.02), Vector3(24, -1.75, -0.35)],
	[Vector3(3.0, 1.53, -1.60), Vector3(5.2, 1.34, -1.62)],
	[Vector3(3.25, 1.60, -2.20), Vector3(0.75, 0.88, -0.26)],
	[Vector3(2.85, 1.60, -0.94), Vector3(1.30, 0.82, -2.98)],
	[Vector3(10.0, 28.0, 39.0), Vector3(22.0, -3.2, -13.0)],
	[Vector3(10.3, -3.28, 23.4), Vector3(27.0, -3.2, 29.0)],
	[Vector3(6.15, 1.62, -0.88), Vector3(32.0, -1.8, -43.0)],
	[Vector3(13.0, -3.37, -19.0), Vector3(17.0, 3.1, -86.0)],
]

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	daylight_prototype_v2 = args.has("--daylight-prototype-v2")
	daylight_prototype = daylight_prototype_v2 or args.has("--daylight-prototype")
	for arg in args:
		if arg == "--inspect" or arg.begins_with("--shot="):
			walk_enabled = false
	loaded_room = $Модель
	_tint_microwave()
	_prepare_asgard_lighting()
	interaction_ray.collision_mask = 11
	interaction_ray.collide_with_areas = true
	_build_trees()
	if walk_enabled:
		_build_interactions(loaded_room)
		_build_collisions(loaded_room)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	sky_material = ShaderMaterial.new()
	sky_material.shader = preload("res://textures/courtyard_sky.gdshader")
	sky.sky_material = sky_material
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.82, 0.86, 0.9)
	env.ambient_light_energy = 0.28
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	room_environment = env
	environment.environment = env
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -110, 0)
	sun.light_energy = 0.45
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60
	add_child(sun)
	daylight.append(sun)
	# Основной рассеянный свет приходит от окна. Тени мебели нужны и в Compatibility.
	_window_light(Vector3(4.15, 1.9, -1.15))
	_window_light(Vector3(4.15, 1.9, -2.35))
	var center_fill := 0.22
	if daylight_prototype: center_fill = 0.09
	if daylight_prototype_v2: center_fill = 0.12
	_fill_light(Vector3(2.3, 2.4, -1.6), center_fill, 4)
	_fill_light(Vector3(-1.3, 2.4, -1.9), 0.8, 3)
	ceiling_light = OmniLight3D.new()
	ceiling_light.position = Vector3(2.3, 2.45, -1.6)
	ceiling_light.light_color = Color(1.0, 0.89, 0.75)
	ceiling_light.light_energy = 0.38
	ceiling_light.omni_range = 5.0
	ceiling_light.shadow_enabled = true
	add_child(ceiling_light)
	# Холодный рассеянный свет с улицы остаётся у оконного проёма.
	evening_window_light = SpotLight3D.new()
	evening_window_light.position = Vector3(4.36, 1.88, -1.88)
	evening_window_light.light_color = Color(0.65, 0.76, 1.0)
	evening_window_light.light_energy = 0.13
	evening_window_light.light_specular = 0.0
	evening_window_light.spot_range = 3.1
	evening_window_light.spot_angle = 46.0
	add_child(evening_window_light)
	evening_window_light.look_at(Vector3(2.4, 0.96, -1.65))
	bedside_light = OmniLight3D.new()
	bedside_light.position = _furniture_point("Тумбочка", Vector3(-0.30, 0.82, 0.05))
	bedside_light.light_color = Color(1.0, 0.18, 0.48)
	bedside_light.light_energy = 0.3
	bedside_light.omni_range = 2.2
	bedside_light.shadow_enabled = true
	add_child(bedside_light)
	courtyard_path = preload("res://scripts/courtyard_path.gd").new()
	add_child(courtyard_path)
	_build_courtyard_lights()
	_build_accent_lighting()
	_set_fast_lights(args.has("--fast-lights"))
	winter_controller = preload("res://scripts/winter_mode.gd").new()
	winter_controller.name = "ЗимнийРежим"
	add_child(winter_controller)
	winter_controller.setup(self)
	_set_lighting(0)
	_build_room_controls()
	camera = Camera3D.new()
	camera.fov = 72
	camera.near = 0.03
	camera.far = 700
	camera.current = true
	if walk_enabled:
		player = CharacterBody3D.new()
		player.name = "Игрок"
		player.set_script(load("res://scripts/player.gd"))
		add_child(player)
		player.add_child(camera)
		player.camera = camera
		camera.position.y = 1.62
		smoking = preload("res://scripts/smoking_fp.gd").new()
		smoking.name = "Руки"
		camera.add_child(smoking)
	else:
		add_child(camera)
	var layer := CanvasLayer.new()
	add_child(layer)
	lamp_menu = preload("res://scripts/lamp_menu.gd").new()
	lamp_menu.room = self
	layer.add_child(lamp_menu)
	garland_menu = preload("res://scripts/garland_menu.gd").new()
	garland_menu.room = self
	garland_menu.winter = winter_controller
	layer.add_child(garland_menu)
	hint = Label.new()
	hint.position = Vector2(20, 18)
	hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	hint.add_theme_constant_override("shadow_offset_x", 1)
	hint.add_theme_constant_override("shadow_offset_y", 1)
	if walk_enabled:
		hint.text = "WASD / стрелки — идти · Клик — захват мыши · Shift — бежать · Пробел — прыжок · Ctrl — присесть · E — взаимодействовать\n2 — у кровати · 3 — на лоджию · 4 — у двери · 5 — комната · Esc — отпустить мышь · F11 — полный экран\nF5 — сохранить · F9 — загрузить · L — день / вечер / ночь · N — цвет ночника · B — подсветка · P — облегчённый свет\n1 — достать пачку · E — вынуть / поджечь сигарету · ЛКМ — затяжка · G — стряхнуть пепел · C — убрать"
	else:
		hint.text = "Осмотр · Клик — мышь · WASD — движение · Q/E — вниз/вверх · Shift — быстрее\n1 — комната · 2 — от кровати · 3 — лоджия · 4 — у двери · Esc — отпустить мышь"
	layer.add_child(hint)
	hint.hide()
	help_button = Button.new()
	help_button.position = Vector2(1020, 18)
	help_button.size = Vector2(240, 38)
	help_button.text = "Управление [H]"
	help_button.tooltip_text = "Показать/скрыть управление. Esc — освободить мышь для нажатия кнопки."
	help_button.focus_mode = Control.FOCUS_NONE
	help_button.pressed.connect(_toggle_help)
	layer.add_child(help_button)
	winter_button = Button.new()
	winter_button.position = Vector2(1020, 64)
	winter_button.size = Vector2(240, 38)
	winter_button.text = "Зимний режим: Выкл"
	winter_button.tooltip_text = "Включить или выключить зимний режим. Esc — освободить мышь."
	winter_button.focus_mode = Control.FOCUS_NONE
	winter_button.pressed.connect(_toggle_winter)
	layer.add_child(winter_button)
	garland_button = Button.new()
	garland_button.position = Vector2(1020, 110)
	garland_button.size = Vector2(240, 38)
	garland_button.text = "Режимы гирлянд"
	garland_button.tooltip_text = "Открыть меню режимов и яркости гирлянд."
	garland_button.focus_mode = Control.FOCUS_NONE
	garland_button.pressed.connect(_open_garland_menu)
	garland_button.hide()
	layer.add_child(garland_button)
	interaction_hint = Label.new()
	interaction_hint.position = Vector2(0, 390)
	interaction_hint.size = Vector2(1280, 40)
	interaction_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	interaction_hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	interaction_hint.add_theme_constant_override("shadow_offset_x", 2)
	interaction_hint.add_theme_constant_override("shadow_offset_y", 2)
	layer.add_child(interaction_hint)
	status_hint = Label.new()
	status_hint.position = Vector2(20, 625)
	status_hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	status_hint.add_theme_constant_override("shadow_offset_x", 2)
	status_hint.add_theme_constant_override("shadow_offset_y", 2)
	layer.add_child(status_hint)
	var crosshair := Label.new()
	crosshair.text = "+"
	crosshair.position = Vector2(635, 348)
	layer.add_child(crosshair)
	crosshair.visible = walk_enabled
	for label in [hint, interaction_hint, crosshair, status_hint]:
		label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--view="): preset = clampi(int(arg.substr(7)), 1, VIEWS.size())
		elif arg.begins_with("--shot="): shot_path = arg.substr(7)
		elif arg.begins_with("--frames="): shot_frames = maxi(1, int(arg.substr(9)))
		elif arg.begins_with("--lamp-color="): lamp_color = clampi(int(arg.substr(13)), 0, LAMP_COLORS.size() - 1)
		elif arg.begins_with("--strip="): strip_mode = clampi(int(arg.substr(8)), 0, 2)
	if args.has("--winter"): _set_winter(true)
	_set_view(preset)
	for arg in args:
		if arg.begins_with("--light="): _set_lighting(clampi(int(arg.substr(8)), 0, 2))
	_update_accent_lighting()
	if not shot_path.is_empty(): layer.hide()
	if walk_enabled:
		call_deferred("_verify_initial_spawn")
		# Игра готова к ходьбе сразу, без переключения ракурса или первого клика.
		# При Esc курсор освобождается для кнопки «Управление».
		if DisplayServer.get_name() != "headless":
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _verify_initial_spawn() -> void:
	# После физического тика коллизии импортированной GLB уже зарегистрированы.
	# При начальном пересечении подбираем свободное место в проверенном проходе.
	await get_tree().physics_frame
	if player == null: return
	if preset != 1 or player.global_position.distance_to(Vector3(1.05, 0.08, -1.6)) > 0.3: return
	if player.can_stand_at(player.global_transform): return
	for at in [Vector3(1.5, 0.08, -1.6), Vector3(2.2, 0.08, -1.6), Vector3(3.0, 0.08, -1.6)]:
		var candidate := Transform3D(player.global_basis, at)
		if player.can_stand_at(candidate):
			player.global_position = at
			player.velocity = Vector3.ZERO
			push_warning("Стартовая точка была занята, игрок перемещён в свободный проход")
			return
	push_warning("Не найдена свободная начальная точка для капсулы; проверьте коллизии комнаты")

func _fill_light(at: Vector3, energy: float, radius: float) -> void:
	var light := OmniLight3D.new()
	light.position = at
	light.light_energy = energy
	light.omni_range = radius
	add_child(light)
	daylight.append(light)

func _window_light(at: Vector3) -> void:
	if daylight_prototype_v2:
		# Вместо круглого блика на откосе и потолке: мягкий направленный
		# переотражённый свет внутрь комнаты. Солнечные тени остаются.
		var window_bounce := SpotLight3D.new()
		window_bounce.position = at
		window_bounce.light_color = Color(1.0, 0.98, 0.94)
		window_bounce.light_energy = 0.15
		window_bounce.light_specular = 0.0
		window_bounce.spot_range = 5.5
		window_bounce.spot_angle = 65.0
		window_bounce.spot_angle_attenuation = 1.0
		window_bounce.shadow_enabled = false
		add_child(window_bounce)
		window_bounce.look_at(Vector3(1.2, 1.1, at.z), Vector3.UP)
		daylight.append(window_bounce)
		return
	var light := OmniLight3D.new()
	light.position = at
	light.light_color = Color(1.0, 0.98, 0.94)
	light.light_energy = 0.055 if daylight_prototype else 0.025
	light.omni_range = 5.5
	light.shadow_enabled = true
	light.shadow_bias = 0.025
	light.shadow_normal_bias = 0.08
	add_child(light)
	daylight.append(light)

func _set_view(index: int) -> void:
	if player != null:
		var eye: Vector3 = VIEWS[index - 1][0]
		var target: Vector3 = VIEWS[index - 1][1]
		player.reset_posture()
		# Первый ракурс для пешей прогулки — середина свободного прохода.
		# Координаты камеры осмотра/скриншота VIEWS не меняем.
		player.position = Vector3(1.05, 0.08, -1.6) if index == 1 else Vector3(eye.x, 0.08, eye.z)
		player.velocity = Vector3.ZERO
		player.look_at(Vector3(target.x, player.position.y, target.z))
		camera.position = Vector3(0, 1.62, 0)
		camera.look_at(target)
		return
	camera.position = VIEWS[index - 1][0]
	camera.look_at(VIEWS[index - 1][1])

func _set_lighting(mode: int) -> void:
	lighting_mode = mode % 3
	for light in daylight: light.visible = lighting_mode == 0
	ceiling_light.visible = lighting_mode == 1
	evening_window_light.visible = lighting_mode == 1
	for light in courtyard_lights:
		light.visible = lighting_mode != 0
	for diffuser in courtyard_diffusers:
		diffuser.visible = lighting_mode != 0
	lamp_on = lighting_mode == 2
	var day_ambient := 0.18 if daylight_prototype else 0.28
	room_environment.ambient_light_energy = [day_ambient, 0.08, 0.015][lighting_mode]
	sky_material.set_shader_parameter("lighting_mode", lighting_mode)
	for material in asgard_day:
		var after_dark := lighting_mode != 0
		material.albedo_texture = asgard_night[material] if after_dark else asgard_day[material]
		material.emission_enabled = after_dark
	if winter_controller != null and winter_controller.enabled:
		winter_controller.apply_lighting(lighting_mode)
	_update_accent_lighting()

func _set_winter(value: bool) -> void:
	if winter_controller == null: return
	winter_controller.set_enabled(value)
	courtyard_path.set_winter(value)
	if winter_button != null:
		winter_button.text = "Зимний режим: Вкл" if value else "Зимний режим: Выкл"
	if garland_button != null:
		garland_button.visible = value
	if not value and garland_menu != null and garland_menu.visible:
		garland_menu._close()

func _toggle_winter() -> void:
	if winter_controller == null: return
	var next: bool = not winter_controller.enabled
	_set_winter(next)
	_show_status("Зимний режим включён" if next else "Зимний режим выключен")

func _open_garland_menu() -> void:
	if garland_menu != null and winter_controller != null and winter_controller.enabled:
		garland_menu.open()

func _prepare_asgard_lighting() -> void:
	var building := loaded_room.get_node_or_null("БЦ Асгард") as MeshInstance3D
	if building == null or building.mesh == null: return
	for surface in building.mesh.get_surface_count():
		var original := building.mesh.surface_get_material(surface) as StandardMaterial3D
		if original == null or not ASGARD_NIGHT_TEXTURES.has(original.resource_name): continue
		var material := original.duplicate() as StandardMaterial3D
		var texture: Texture2D = ASGARD_NIGHT_TEXTURES[original.resource_name]
		material.emission = Color.BLACK
		material.emission_texture = ASGARD_EMISSION_TEXTURES[original.resource_name]
		material.emission_energy_multiplier = 0.28
		material.emission_operator = BaseMaterial3D.EMISSION_OP_ADD
		building.set_surface_override_material(surface, material)
		asgard_day[material] = original.albedo_texture
		asgard_night[material] = texture

func _build_courtyard_lights() -> void:
	# Головки существующих опор у 46 к2, см. blender/детали.py.
	for z in [6.0, -15.0]:
		var at := Vector3(20.916, 1.22, z)
		var light := SpotLight3D.new()
		light.position = at
		light.light_color = Color(1.0, 0.86, 0.69)
		light.light_energy = 2.6
		light.light_specular = 0.0
		light.spot_range = 12.0
		light.spot_angle = 54.0
		add_child(light)
		light.look_at(at + Vector3(-1.7, -6.0, 0.0))
		courtyard_lights.append(light)

		var diffuser := MeshInstance3D.new()
		var panel := BoxMesh.new()
		panel.size = Vector3(0.29, 0.018, 0.15)
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.albedo_color = Color(1.0, 0.92, 0.76)
		panel.material = material
		diffuser.mesh = panel
		diffuser.position = at
		add_child(diffuser)
		courtyard_diffusers.append(diffuser)

func _set_fast_lights(enabled: bool) -> void:
	if original_shadows.is_empty():
		for light in daylight:
			if not light is DirectionalLight3D:
				original_shadows[light] = light.shadow_enabled
		original_shadows[bedside_light] = bedside_light.shadow_enabled
		for light in strip_lights:
			original_shadows[light] = light.shadow_enabled
	fast_lights = enabled
	for light in original_shadows:
		light.shadow_enabled = original_shadows[light] and not enabled

func _toggle_ceiling_light() -> void:
	ceiling_light.visible = not ceiling_light.visible
	_show_status("Главный свет включён" if ceiling_light.visible else "Главный свет выключен")

func _tint_microwave() -> void:
	var microwave := loaded_room.get_node_or_null("Тумба СВЧ/Микроволновка")
	if microwave == null: return
	for mesh in microwave.find_children("*", "MeshInstance3D", true, false):
		for surface in mesh.mesh.get_surface_count():
			var material := mesh.get_active_material(surface) as StandardMaterial3D
			if material == null or material.resource_name != "пластик_белый": continue
			var casing := material.duplicate() as StandardMaterial3D
			casing.albedo_color = Color("#24252a")
			mesh.set_surface_override_material(surface, casing)

func _build_accent_lighting() -> void:
	# Готовые StandardMaterial3D и OmniLight3D Godot. Копии материалов только
	# на экземпляре комнаты: импортированный GLB и общие ресурсы не меняются.
	for mesh in loaded_room.find_children("*", "MeshInstance3D", true, false):
		for surface in mesh.mesh.get_surface_count():
			var material := mesh.get_active_material(surface) as StandardMaterial3D
			if material == null: continue
			if material.resource_name == "подсветка_клав":
				var keyboard := material.duplicate() as StandardMaterial3D
				keyboard.albedo_color = Color(0.24, 0.15, 0.32)
				keyboard.emission = Color(0.62, 0.37, 0.82)
				keyboard.emission_energy_multiplier = 0.19
				mesh.set_surface_override_material(surface, keyboard)
				continue
			if material.resource_name == "экран":
				if mesh == loaded_room.get_node("Письменный стол"):
					_set_wallpaper(mesh, surface)
				else:
					var dark_screen := material.duplicate() as StandardMaterial3D
					dark_screen.emission_enabled = false
					dark_screen.roughness = 0.32
					mesh.set_surface_override_material(surface, dark_screen)
				continue
			if material.resource_name not in ["ночник", "лента", "лента_стол", "кулеры_пк"]: continue
			var key := material.resource_name
			if not light_materials.has(key): light_materials[key] = material.duplicate()
			mesh.set_surface_override_material(surface, light_materials[key])
	# Горизонтальная лента за столом до кровати и лента над её щитом.
	# Ограниченный радиус и тени оставляют углы и полку тёмными.
	for at in [
		_furniture_point("Письменный стол", Vector3(-0.23, 0.79, -0.05)),
		_furniture_point("Письменный стол", Vector3(0.22, 0.80, -0.05)),
		_furniture_point("Кровать у стола", Vector3(-0.48, 1.08, -0.07)),
		_furniture_point("Кровать у стола", Vector3(0.30, 1.08, -0.07)),
		_furniture_point("Кровать у стола", Vector3(0.88, 1.08, -0.43)),
	]:
		var light := OmniLight3D.new()
		light.position = at
		light.light_energy = 0.14
		light.omni_range = 1.15
		light.shadow_enabled = true
		light.shadow_bias = 0.025
		light.shadow_normal_bias = 0.08
		add_child(light)
		strip_lights.append(light)

	monitor_light = OmniLight3D.new()
	monitor_light.position = _furniture_point("Письменный стол", Vector3(-0.135, 0.96, 0.39))
	monitor_light.light_color = Color(0.79, 0.46, 0.78)
	monitor_light.light_energy = 0.04
	monitor_light.omni_range = 0.76
	add_child(monitor_light)

func _set_wallpaper(mesh: MeshInstance3D, surface: int) -> void:
	# Стол экспортируется одним мешем. Берём габариты только поверхности экрана.
	var vertices: PackedVector3Array = mesh.mesh.surface_get_arrays(surface)[Mesh.ARRAY_VERTEX]
	var bounds := AABB(vertices[0], Vector3.ZERO)
	for vertex in vertices:
		bounds = bounds.expand(vertex)
	var display := ShaderMaterial.new()
	display.shader = preload("res://textures/monitor_screen.gdshader")
	display.set_shader_parameter("wallpaper", preload("res://textures/monitor_wallpaper.jpg"))
	display.set_shader_parameter("screen_min", Vector2(bounds.position.x, bounds.position.y))
	display.set_shader_parameter("screen_size", Vector2(bounds.size.x, bounds.size.y))
	mesh.set_surface_override_material(surface, display)

func _update_accent_lighting() -> void:
	monitor_light.visible = lighting_mode != 0
	var lamp_tint: Color = LAMP_COLORS[lamp_preview if lamp_preview >= 0 else lamp_color]
	bedside_light.visible = lamp_on
	bedside_light.light_color = lamp_tint
	bedside_light.light_energy = 0.3 * lamp_brightness
	for light in strip_lights:
		light.visible = strip_mode != 0
		light.light_color = STRIP_COLORS[strip_mode]
	for key in light_materials:
		var material := light_materials[key] as StandardMaterial3D
		var is_lamp: bool = key == "ночник"
		var enabled := lamp_on if is_lamp else strip_mode != 0
		var color: Color = lamp_tint if is_lamp else STRIP_COLORS[strip_mode]
		material.emission_enabled = enabled
		# Яркая середина рассеивателя почти белая на фото; окружающий свет цветной.
		material.emission = color.lerp(Color.WHITE, 0.65) if is_lamp else color
		material.emission_energy_multiplier = 2.8 * lamp_brightness if is_lamp else 2.0
		material.albedo_color = Color(0.95, 0.95, 0.95) if is_lamp else (color if enabled else Color(0.45, 0.45, 0.43))

func _cycle_lamp_color() -> void:
	lamp_color = (lamp_color + 1) % LAMP_COLORS.size()
	_update_accent_lighting()
	_show_status("Цвет ночника: " + LAMP_NAMES[lamp_color])

func _cycle_strip() -> void:
	strip_mode = (strip_mode + 1) % STRIP_COLORS.size()
	_update_accent_lighting()
	_show_status("Подсветка: " + STRIP_NAMES[strip_mode])

func _toggle_help() -> void:
	hint.visible = not hint.visible
	help_button.text = "Скрыть управление [H]" if hint.visible else "Управление [H]"

func _menu_open() -> bool:
	return (lamp_menu != null and lamp_menu.visible) or (garland_menu != null and garland_menu.visible)

func _input(event: InputEvent) -> void:
	if lamp_menu == null or _menu_open(): return
	if smoking != null and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and smoking.handle_event(event):
		get_viewport().set_input_as_handled()
		return
	if player != null and player.resting.is_empty() and event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var target := _interaction_target() as Area3D
		if target != null and target in room_controls and target.kind == "lamp":
			lamp_menu.open()
			get_viewport().set_input_as_handled()
			return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_N:
			_cycle_lamp_color()
			get_viewport().set_input_as_handled()
		elif event.physical_keycode == KEY_B:
			_cycle_strip()
			get_viewport().set_input_as_handled()
		elif event.physical_keycode == KEY_P:
			_set_fast_lights(not fast_lights)
			_show_status("Облегчённый свет включён" if fast_lights else "Облегчённый свет выключен")
			get_viewport().set_input_as_handled()
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_L:
		_set_lighting(lighting_mode + 1)
		_show_status(["Дневной свет", "Вечерний свет", "Ночник"][lighting_mode])
		get_viewport().set_input_as_handled()
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_H:
		_toggle_help()
		get_viewport().set_input_as_handled()

func _unhandled_input(event: InputEvent) -> void:
	if _menu_open(): return
	if player != null:
		if event is InputEventKey and event.pressed and not event.echo:
			if event.physical_keycode == KEY_F5:
				_show_status("Сохранено" if save_walk() == OK else "Не удалось сохранить")
			elif event.physical_keycode == KEY_F9:
				var result := load_walk()
				_show_status("Сохранение загружено" if result == OK else ("Сохранения пока нет" if result == ERR_FILE_NOT_FOUND else "Не удалось загрузить сохранение"))
		if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_E and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			if not player.resting.is_empty():
				if not player.leave_rest(): _show_status("Место для вставания занято")
			else:
				var item := _interaction_target()
				if item != null: item.toggle()
		if event is InputEventKey and event.pressed and not event.echo:
			if event.physical_keycode == KEY_5:
				_set_view(1)
			elif event.physical_keycode >= KEY_2 and event.physical_keycode <= KEY_4:
				_set_view(event.physical_keycode - KEY_1 + 1)
		return
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_4:
			_set_view(event.physical_keycode - KEY_1 + 1)
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		camera.rotation.y -= event.relative.x * 0.0025
		camera.rotation.x = clampf(camera.rotation.x - event.relative.y * 0.0025, -1.5, 1.5)

func _process(delta: float) -> void:
	if camera == null: return
	if not shot_path.is_empty():
		shot_frames -= 1
		if shot_frames <= 0:
			var target := ProjectSettings.globalize_path(shot_path) if shot_path.is_absolute_path() else ProjectSettings.globalize_path("res://" + shot_path)
			DirAccess.make_dir_recursive_absolute(target.get_base_dir())
			var result := get_viewport().get_texture().get_image().save_png(target)
			get_tree().quit(0 if result == OK else 1)
		return
	status_time = maxf(0, status_time - delta)
	status_hint.visible = status_time > 0
	if player != null:
		var item := _interaction_target() if player.resting.is_empty() and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED else null
		interaction_hint.text = "E / Пробел — встать" if not player.resting.is_empty() else (item.prompt() if item != null else "")
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and not _menu_open():
			var smoking_prompt: String = smoking.interaction_prompt()
			if not smoking_prompt.is_empty():
				interaction_hint.text = smoking_prompt
		return
	if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED: return
	var direction := Vector3(
		float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)),
		float(Input.is_physical_key_pressed(KEY_E)) - float(Input.is_physical_key_pressed(KEY_Q)),
		float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	var speed := 7.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 1.7
	camera.position += camera.basis * direction.normalized() * speed * minf(delta, 0.1)

func _build_collisions(room: Node) -> void:
	# Точная статическая геометрия комнаты; дальний квартал не участвует в физике.
	# Collider получается из той же GLB, без второй ручной схемы стен/мебели.
	var faces := PackedVector3Array()
	var nodes := room.find_children("*", "MeshInstance3D", true, false)
	if room is MeshInstance3D: nodes.append(room)
	var bounds := AABB(Vector3(-3.8, -0.15, -3.6), Vector3(10.7, 3.1, 4.0))
	# Пакеты/бутылки у порога — мягкая бытовая мелочь, не непроходимая стена.
	# Исключаем только их маленькую область; большие треугольники пола остаются.
	var clutter := AABB(Vector3(-0.55, -0.05, -0.72), Vector3(0.60, 0.50, 0.72))
	var clothing_root := room.get_node_or_null("Шкаф/Пиджак_в_шкафу")
	var broadphase := bounds.grow(0.001)
	for node in nodes:
		var mesh_node: MeshInstance3D = node
		if mesh_node.get_parent() in interactables or str(mesh_node.name).begins_with("Curtain_"): continue
		if clothing_root != null and clothing_root.is_ancestor_of(mesh_node): continue
		if mesh_node.mesh == null: continue
		var mesh_transform := mesh_node.global_transform
		var mesh_bounds: AABB = mesh_transform * mesh_node.get_aabb()
		if not broadphase.intersects(mesh_bounds): continue
		var fully_inside := bounds.encloses(mesh_bounds)
		var triangles := mesh_node.mesh.get_faces()
		for i in range(0, triangles.size(), 3):
			var a: Vector3 = mesh_transform * triangles[i]
			var b: Vector3 = mesh_transform * triangles[i + 1]
			var c: Vector3 = mesh_transform * triangles[i + 2]
			if clutter.has_point(a) and clutter.has_point(b) and clutter.has_point(c): continue
			if fully_inside or (bounds.has_point(a) and bounds.has_point(b) and bounds.has_point(c)):
				if (b - a).cross(c - a).length_squared() > 0.000000000001:
					faces.append(a)
					faces.append(b)
					faces.append(c)
	var body := StaticBody3D.new()
	body.name = "Стены_и_мебель"
	var collision := CollisionShape3D.new()
	var shape := ConcavePolygonShape3D.new()
	shape.backface_collision = true
	shape.set_faces(faces)
	collision.shape = shape
	body.add_child(collision)
	add_child(body)
	print("Физика комнаты: ", faces.size() / 3, " треугольников")

func _build_interactions(room: Node3D) -> void:
	var settings = JSON.parse_string(FileAccess.get_file_as_string("res://models/подвижные.json"))
	for spec in settings:
		var mesh_node := room.find_child(spec.node, true, false) as MeshInstance3D
		assert(mesh_node != null, "В GLB отсутствует подвижный узел: " + spec.node)
		var body := AnimatableBody3D.new()
		body.set_script(load("res://scripts/movable.gd"))
		var parent := mesh_node.get_parent()
		parent.add_child(body)
		body.configure(mesh_node, spec)
		body.name = spec.node
		interactables.append(body)

func _interaction_target() -> Node3D:
	var origin := camera.global_position
	interaction_ray.from = origin
	interaction_ray.to = origin - camera.global_basis.z * 2.0
	var hit := get_world_3d().direct_space_state.intersect_ray(interaction_ray)
	var collider := hit.get("collider") as Node3D
	var area := collider as Area3D
	if collider != null and (collider in interactables or (area != null and area in room_controls)):
		return collider
	return null

func _show_status(message: String) -> void:
	status_hint.text = message
	status_time = 3.0

func save_walk(path: String = SAVE_PATH) -> Error:
	var data := ConfigFile.new()
	data.set_value("walk", "version", 1)
	data.set_value("walk", "furniture_local", true)
	data.set_value("walk", "lighting", lighting_mode)
	data.set_value("walk", "ceiling_on", ceiling_light.visible)
	data.set_value("walk", "lamp_color", lamp_color)
	data.set_value("walk", "lamp_on", lamp_on)
	data.set_value("walk", "lamp_brightness", lamp_brightness)
	data.set_value("walk", "strip_mode", strip_mode)
	if winter_controller != null:
		data.set_value("walk", "winter_enabled", winter_controller.enabled)
		data.set_value("walk", "garland_on", winter_controller.garland_on)
		data.set_value("walk", "garland_mode", winter_controller.garland_mode)
		data.set_value("walk", "garland_brightness", winter_controller.garland_brightness)
	var curtains := {}
	for control in room_controls:
		if control.kind == "curtain": curtains[str(control.name)] = control.closed
	data.set_value("walk", "curtains", curtains)
	data.set_value("walk", "player", player.return_transform if not player.resting.is_empty() else player.transform)
	data.set_value("walk", "camera_pitch", camera.rotation.x)
	var items := {}
	for item in interactables:
		items[item.spec.node] = item.save() # COGITO state schema, stable ID from Blender export
	data.set_value("walk", "items", items)
	return data.save(path)

func load_walk(path: String = SAVE_PATH) -> Error:
	var data := ConfigFile.new()
	var error := data.load(path)
	if error != OK: return error
	for key in ["player", "camera_pitch", "items"]:
		if not data.has_section_key("walk", key): return ERR_INVALID_DATA
	var saved_player = data.get_value("walk", "player")
	var pitch = data.get_value("walk", "camera_pitch")
	var items = data.get_value("walk", "items")
	var furniture_local = data.get_value("walk", "furniture_local", false)
	if data.get_value("walk", "version", 0) != 1 or not saved_player is Transform3D or not pitch is float or not items is Dictionary:
		return ERR_INVALID_DATA
	if not furniture_local is bool or not is_finite(pitch) or not saved_player.is_finite():
		return ERR_INVALID_DATA
	if not saved_player.basis.is_conformal() or not is_equal_approx(saved_player.basis.determinant(), 1.0):
		return ERR_INVALID_DATA
	for item in interactables:
		var state = items.get(item.spec.node)
		if state == null: continue # новые узлы остаются в начальной позе старого сохранения
		if not state is Dictionary: return ERR_INVALID_DATA
		for key in ["pos_x", "pos_y", "pos_z", "rot_x", "rot_y", "rot_z"]:
			if not state.get(key) is float or not is_finite(state[key]): return ERR_INVALID_DATA
		if not state.get("is_open") is bool or not state.get("is_locked") is bool: return ERR_INVALID_DATA
	var saved_light = data.get_value("walk", "lighting", 0)
	if not saved_light is int or saved_light < 0 or saved_light > 2: return ERR_INVALID_DATA
	var saved_lamp = data.get_value("walk", "lamp_color", 0)
	var saved_strip = data.get_value("walk", "strip_mode", 0)
	if not saved_lamp is int or saved_lamp < 0 or saved_lamp >= LAMP_COLORS.size(): return ERR_INVALID_DATA
	if not saved_strip is int or saved_strip < 0 or saved_strip >= STRIP_COLORS.size(): return ERR_INVALID_DATA
	var saved_power = data.get_value("walk", "lamp_on", saved_light == 2)
	var saved_brightness = data.get_value("walk", "lamp_brightness", 1.0)
	if not saved_power is bool or not saved_brightness is float or not is_finite(saved_brightness) or saved_brightness < 0.05 or saved_brightness > 1.0:
		return ERR_INVALID_DATA
	var saved_ceiling = data.get_value("walk", "ceiling_on", saved_light == 1)
	var curtains = data.get_value("walk", "curtains", {})
	if not saved_ceiling is bool or not curtains is Dictionary: return ERR_INVALID_DATA
	for key in curtains:
		if not key is String or not curtains[key] is bool: return ERR_INVALID_DATA
	smoking.put_away()
	lamp_color = saved_lamp
	lamp_brightness = saved_brightness
	strip_mode = saved_strip
	_set_lighting(saved_light)
	ceiling_light.visible = saved_ceiling
	lamp_on = saved_power
	if winter_controller != null:
		var saved_winter = data.get_value("walk", "winter_enabled", false)
		var saved_g_on = data.get_value("walk", "garland_on", true)
		var saved_g_mode = data.get_value("walk", "garland_mode", 0)
		var saved_g_bright = data.get_value("walk", "garland_brightness", 0.85)
		if saved_g_on is bool: winter_controller.set_garland_on(saved_g_on)
		if saved_g_mode is int: winter_controller.set_garland_mode(saved_g_mode)
		if saved_g_bright is float and is_finite(saved_g_bright): winter_controller.set_garland_brightness(saved_g_bright)
		if saved_winter is bool: _set_winter(saved_winter)
	_update_accent_lighting()
	for control in room_controls:
		if control.kind == "curtain": control.set_closed(curtains.get(str(control.name), false), true)
	player.reset_posture()
	player.transform = saved_player
	player.velocity = Vector3.ZERO
	player.jump_queued = false
	camera.rotation.x = clampf(pitch, -1.45, 1.45)
	for item in interactables:
		if items.has(item.spec.node):
			item.restore_state(items[item.spec.node], not furniture_local and item.spec.has("furniture"))
	return OK

func _furniture_point(label: String, offset: Vector3) -> Vector3:
	var furniture := loaded_room.get_node(NodePath(label)) as Node3D
	return to_local(furniture.to_global(offset))

func _build_room_controls() -> void:
	for entry in [
		["Стул у стола", Vector3(0, 0.45, 0.20), Vector3(0.20, 1.00, 1.00), "chair", Vector3(0.50, 0.35, 0.50)],
		["Стул у столика", Vector3(0, 0.45, 0), Vector3(0, 1.15, -0.9), "chair", Vector3(0.50, 0.35, 0.50)],
		["Кровать у стола", Vector3(0, 0.45, -0.45), Vector3(-1.75, 0.8, -0.45), "bed", Vector3(1.8, 0.18, 0.75)],
		["Кровать у лоджии", Vector3(0, 0.45, 0.45), Vector3(-2.55, 0.8, 0.45), "bed", Vector3(1.8, 0.18, 0.75)]]:
		var furniture := loaded_room.get_node(NodePath(entry[0])) as Node3D
		var control := _add_room_control(entry[0], to_local(furniture.to_global(entry[1])), entry[4], entry[3])
		control.global_basis = furniture.global_basis.orthonormalized()
		control.rest_target = furniture.to_global(entry[2])
	# Проёмы и размеры по существующей Blender-сцене, без новых внешних зависимостей.
	_add_room_control("Выключатель", Vector3(0.34, 1.09, -0.02), Vector3(0.13, 0.14, 0.07), "light")
	_add_room_control("Ночник", _furniture_point("Тумбочка", Vector3(-0.20, 0.70, 0.05)), Vector3(0.15, 0.21, 0.15), "lamp")
	for index in range(2):
		var control := _add_room_control("Штора_%s" % index, Vector3(4.49, 1.3, -0.36 if index == 0 else -2.85), Vector3(0.18, 2.5, 0.75), "curtain")
		control.cloth = loaded_room.find_child("Curtain_%s" % index, true, false)
		if control.cloth != null:
			control.original_scale = control.cloth.scale
			control.set_closed(false, true)

func _add_room_control(label: String, at: Vector3, size: Vector3, kind: String) -> Area3D:
	var control := Area3D.new()
	control.name = label
	control.set_script(load("res://scripts/room_control.gd"))
	control.kind = kind
	control.scene = self
	control.collision_layer = 8
	control.collision_mask = 0
	add_child(control)
	control.position = at
	control.original_position = at
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape.shape = box
	control.add_child(shape)
	room_controls.append(control)
	return control

func _build_trees() -> void:
	var packed := load("res://models/дерево.glb") as PackedScene
	for at in [Vector3(46, -5, 8), Vector3(45, -5, -30)]:
		var tree := packed.instantiate() as Node3D
		add_child(tree)
		tree.position = at
		tree.rotation.y = at.x * 0.41
		tree.scale = Vector3.ONE * (1.8 + fmod(at.x, 3.0) * 0.15)
		trees.append(tree)
