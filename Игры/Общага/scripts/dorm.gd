extends Node3D
## Осмотр существующей Blender-сборки. Координаты Blender (x,y,z) → Godot (x,z,-y).

var camera: Camera3D
var hint: Label
var shot_path := ""
var shot_frames := 30
var preset := 1
var player: CharacterBody3D
var walk_enabled := true

const VIEWS := [
	[Vector3(0.75, 1.62, -1.6), Vector3(4.6, 1.3, -1.6)],
	[Vector3(4.0, 0.95, -1.85), Vector3(0, 1.2, -0.25)],
	[Vector3(5.35, 1.62, -0.9), Vector3(35, 1.62, -0.9)],
]

func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	for arg in args:
		if arg == "--inspect" or arg.begins_with("--shot="):
			walk_enabled = false
	var path := "res://models/общага.glb"
	if not ResourceLoader.exists(path):
		push_error("Сначала соберите models/общага.glb: blender --background --python blender/экспорт.py")
		get_tree().quit(1)
		return
	var packed: PackedScene = load(path)
	var room := packed.instantiate()
	add_child(room)
	if walk_enabled:
		_build_collisions(room)
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color(0.42, 0.54, 0.65)
	sky_material.sky_horizon_color = Color(0.78, 0.81, 0.81)
	sky.sky_material = sky_material
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.82, 0.86, 0.9)
	env.ambient_light_energy = 0.28
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment = env
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-38, -110, 0)
	sun.light_energy = 0.45
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 180
	add_child(sun)
	# Основной рассеянный свет приходит от окна. Тени мебели нужны и в Compatibility.
	_window_light(Vector3(4.15, 1.9, -1.15))
	_window_light(Vector3(4.15, 1.9, -2.35))
	_fill_light(Vector3(2.3, 2.4, -1.6), 0.22, 4)
	_fill_light(Vector3(-1.3, 2.4, -1.9), 0.8, 3)
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
	else:
		add_child(camera)
	var layer := CanvasLayer.new()
	add_child(layer)
	hint = Label.new()
	hint.position = Vector2(20, 18)
	hint.add_theme_color_override("font_shadow_color", Color.BLACK)
	hint.add_theme_constant_override("shadow_offset_x", 1)
	hint.add_theme_constant_override("shadow_offset_y", 1)
	if walk_enabled:
		hint.text = "Клик — начать · WASD / стрелки — идти · Shift — бежать · Пробел — прыжок\n1 — комната · 2 — у кровати · 3 — на лоджию · Esc — отпустить мышь · F11 — полный экран"
	else:
		hint.text = "Осмотр · Клик — мышь · WASD — движение · Q/E — вниз/вверх · Shift — быстрее\n1 — комната · 2 — от кровати · 3 — лоджия · Esc — отпустить мышь"
	layer.add_child(hint)
	var credit := Label.new()
	credit.position = Vector2(20, 675)
	credit.text = "Контуры: © участники OpenStreetMap · ODbL 1.0 · Фасады и высоты — черновик"
	credit.add_theme_font_size_override("font_size", 14)
	layer.add_child(credit)
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--view="): preset = clampi(int(arg.substr(7)), 1, VIEWS.size())
		elif arg.begins_with("--shot="): shot_path = arg.substr(7)
		elif arg.begins_with("--frames="): shot_frames = maxi(1, int(arg.substr(9)))
	_set_view(preset)
	if not shot_path.is_empty(): layer.hide()

func _fill_light(at: Vector3, energy: float, radius: float) -> void:
	var light := OmniLight3D.new()
	light.position = at
	light.light_energy = energy
	light.omni_range = radius
	add_child(light)

func _window_light(at: Vector3) -> void:
	var light := OmniLight3D.new()
	light.position = at
	light.light_color = Color(1.0, 0.98, 0.94)
	light.light_energy = 0.025
	light.omni_range = 5.5
	light.shadow_enabled = true
	light.shadow_bias = 0.025
	light.shadow_normal_bias = 0.08
	add_child(light)

func _set_view(index: int) -> void:
	if player != null:
		var eye: Vector3 = VIEWS[index - 1][0]
		var target: Vector3 = VIEWS[index - 1][1]
		player.position = Vector3(eye.x, 0.08, eye.z)
		player.velocity = Vector3.ZERO
		player.look_at(Vector3(target.x, player.position.y, target.z))
		camera.position = Vector3(0, 1.62, 0)
		camera.look_at(target)
		return
	camera.position = VIEWS[index - 1][0]
	camera.look_at(VIEWS[index - 1][1])

func _unhandled_input(event: InputEvent) -> void:
	if player != null:
		if event is InputEventKey and event.pressed and event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_3:
			_set_view(event.physical_keycode - KEY_1 + 1)
		return
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode >= KEY_1 and event.physical_keycode <= KEY_3:
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
	if player != null: return
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
	var bounds := AABB(Vector3(-2.6, -0.15, -3.6), Vector3(9.1, 3.1, 4.0))
	# Пакеты/бутылки у порога — мягкая бытовая мелочь, не непроходимая стена.
	# Исключаем только их маленькую область; большие треугольники пола остаются.
	var clutter := AABB(Vector3(-0.55, -0.05, -0.72), Vector3(0.60, 0.50, 0.72))
	for node in nodes:
		var mesh_node: MeshInstance3D = node
		var triangles := mesh_node.mesh.get_faces()
		for i in range(0, triangles.size(), 3):
			var a: Vector3 = mesh_node.global_transform * triangles[i]
			var b: Vector3 = mesh_node.global_transform * triangles[i + 1]
			var c: Vector3 = mesh_node.global_transform * triangles[i + 2]
			if clutter.has_point(a) and clutter.has_point(b) and clutter.has_point(c): continue
			if bounds.has_point(a) and bounds.has_point(b) and bounds.has_point(c):
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
