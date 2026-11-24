extends Node3D
## Контроллер зимнего режима: снег и умеренные сугробы с учётом расчистки,
## зимние деревья без листвы, лёгкий снегопад снаружи и гирлянды вдоль кроватей.

const SNOW_SHADER := preload("res://textures/winter_snow.gdshader")

const GARLAND_MODES := [
	{"name": "Тёплый свет", "desc": "Ровное уютное тёплое свечение", "accent": Color(1.0, 0.78, 0.40)},
	{"name": "Разноцветный", "desc": "Классические новогодние разноцветные огоньки", "accent": Color(0.95, 0.35, 0.32)},
	{"name": "Мягкое дыхание", "desc": "Плавное затухание и разгорание тёплого света", "accent": Color(1.0, 0.68, 0.34)},
	{"name": "Мерцание", "desc": "Деликатное переливание разноцветных лампочек", "accent": Color(0.32, 0.85, 0.52)},
	{"name": "Бегущие огоньки", "desc": "Плавная волна света вдоль обеих кроватей", "accent": Color(0.35, 0.68, 1.0)},
	{"name": "Зимний лёд", "desc": "Холодное бело-голубое мерцание", "accent": Color(0.68, 0.88, 1.0)},
]

const MULTI_COLORS := [
	Color(1.0, 0.24, 0.18),
	Color(1.0, 0.78, 0.22),
	Color(0.22, 0.90, 0.44),
	Color(0.28, 0.60, 1.0),
]

const FROST_COLORS := [
	Color(0.92, 0.96, 1.0),
	Color(0.62, 0.84, 1.0),
	Color(0.78, 0.91, 1.0),
	Color(0.52, 0.74, 1.0),
]

var room: Node3D
var enabled := false
var garland_on := true
var garland_mode := 0
var garland_brightness := 0.85
var _anim_time := 0.0

# Оригинальные параметры освещения для точного отката при выключении зимы.
var _saved_lighting := false
var _orig_sun_color := Color.WHITE
var _orig_sun_energy := 0.45
var _orig_ambient_color := Color(0.82, 0.86, 0.9)
var _orig_window_colors: Dictionary[Light3D, Color] = {}

# Кэш летних/зимних материалов уличных мешей и листвы деревьев.
var _outdoor_overrides: Array[Dictionary] = []
var _foliage_nodes: Array[Node3D] = []
var _foliage_surfaces: Array[Dictionary] = []

# Узлы, видимые только зимой.
var _snow_root: Node3D
var _snowfall_near: GPUParticles3D
var _snowfall_far: GPUParticles3D
var _garland_root: Node3D
var _garland_channel_mats: Array[StandardMaterial3D] = []
var _garland_lights: Array[OmniLight3D] = []

# Общие зимние материалы.
var _ground_snow_mat: StandardMaterial3D
var _road_winter_mat: StandardMaterial3D
var _walk_winter_mat: StandardMaterial3D
var _roof_snow_pass: ShaderMaterial
var _evergreen_snow_pass: ShaderMaterial
var _branch_frost_pass: ShaderMaterial
var _walk_frost_pass: ShaderMaterial
var _hidden_foliage_mat: StandardMaterial3D

var _ground_y := -5.0


func setup(target_room: Node3D) -> void:
	room = target_room
	_init_materials()
	_scan_outdoor_scene()
	_build_snowdrifts()
	_build_snowfall()
	_build_garlands()
	set_enabled(false)


func _init_materials() -> void:
	_ground_snow_mat = StandardMaterial3D.new()
	_ground_snow_mat.albedo_color = Color(0.87, 0.91, 0.96)
	_ground_snow_mat.roughness = 0.88
	_ground_snow_mat.metallic = 0.0

	# Расчищенный зимний асфальт (тёмный, слегка влажный/подмёрзший, не завален сугробами).
	_road_winter_mat = StandardMaterial3D.new()
	_road_winter_mat.albedo_color = Color(0.14, 0.15, 0.17)
	_road_winter_mat.roughness = 0.64

	# Расчищенные тротуары с лёгкой зимней припорошенностью по краям.
	_walk_frost_pass = _make_snow_pass(0.85, 0.28, 0.45, 0.004)
	_walk_winter_mat = StandardMaterial3D.new()
	_walk_winter_mat.albedo_color = Color(0.36, 0.38, 0.42)
	_walk_winter_mat.roughness = 0.78
	_walk_winter_mat.next_pass = _walk_frost_pass

	_roof_snow_pass = _make_snow_pass(0.66, 0.92, 0.25, 0.008)
	_evergreen_snow_pass = _make_snow_pass(0.45, 0.78, 0.85, 0.006)
	_branch_frost_pass = _make_snow_pass(0.55, 0.55, 1.4, 0.004)

	_hidden_foliage_mat = StandardMaterial3D.new()
	_hidden_foliage_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_hidden_foliage_mat.albedo_color = Color(1.0, 1.0, 1.0, 0.0)
	_hidden_foliage_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED


func _make_snow_pass(threshold: float, cov: float, n_scale: float, offset: float) -> ShaderMaterial:
	var mat := ShaderMaterial.new()
	mat.shader = SNOW_SHADER
	mat.set_shader_parameter("normal_threshold", threshold)
	mat.set_shader_parameter("coverage", cov)
	mat.set_shader_parameter("noise_scale", n_scale)
	mat.set_shader_parameter("min_world_x", 6.66)
	mat.set_shader_parameter("normal_offset", offset)
	return mat


func _scan_outdoor_scene() -> void:
	# Экспорт объединяет двор в один меш, сохраняя отдельные материалы объектов.
	var courtyard := room.loaded_room.get_node_or_null("Окружение") as MeshInstance3D
	if courtyard != null:
		for surface in courtyard.mesh.get_surface_count():
			var material := courtyard.get_active_material(surface) as StandardMaterial3D
			if material == null: continue
			var color := material.albedo_color.srgb_to_linear()
			if _matches_palette(color, Color(0.27, 0.33, 0.20)):
				_register_surface_override(courtyard, surface, _ground_snow_mat)
			elif _matches_palette(color, Color(0.20, 0.20, 0.21)):
				_register_surface_override(courtyard, surface, _road_winter_mat)
			elif _matches_palette(color, Color(0.45, 0.44, 0.42)):
				_register_surface_override(courtyard, surface, _walk_winter_mat)
			elif _matches_palette(color, Color(0.07, 0.20, 0.10)):
				_register_surface_next_pass(courtyard, surface, _evergreen_snow_pass)
			elif absf(color.b - 0.10) < 0.001 and color.r >= 0.129 and color.r <= 0.211 and color.g >= 0.279 and color.g <= 0.381:
				_register_surface_override(courtyard, surface, _hidden_foliage_mat)
			elif _matches_palette(color, Color(0.25, 0.20, 0.15)):
				_register_surface_next_pass(courtyard, surface, _branch_frost_pass)
			else:
				_register_surface_next_pass(courtyard, surface, _roof_snow_pass)

	var asgard := room.loaded_room.get_node_or_null("БЦ Асгард") as MeshInstance3D
	if asgard != null:
		_register_next_pass(asgard, _roof_snow_pass)
	for tree in room.trees:
		_process_procedural_tree(tree)


func _matches_palette(color: Color, source: Color) -> bool:
	return absf(color.r - source.r) < 0.001 and absf(color.g - source.g) < 0.001 and absf(color.b - source.b) < 0.001


func _process_procedural_tree(tree: Node3D) -> void:
	if tree == null: return
	for node in tree.find_children("*", "MeshInstance3D", true, false):
		var mesh_node := node as MeshInstance3D
		if mesh_node == null or mesh_node.mesh == null: continue
		var lname := str(mesh_node.name).to_lower()
		var name_is_leaf := ("лист" in lname or "leaf" in lname or "leaves" in lname or "foliage" in lname or "крона" in lname or "crown" in lname or "canopy" in lname)
		if name_is_leaf:
			_foliage_nodes.append(mesh_node)
			continue
		for surface in mesh_node.mesh.get_surface_count():
			var mat := mesh_node.get_active_material(surface) as StandardMaterial3D
			var mat_name := mat.resource_name.to_lower() if mat != null else ""
			var is_green := false
			if mat != null:
				var c := mat.albedo_color
				is_green = (c.g > c.r * 1.12 and c.g > c.b * 1.12)
			var is_leaf_surface := is_green or ("лист" in mat_name or "leaf" in mat_name or "leaves" in mat_name or "foliage" in mat_name or "крона" in mat_name)
			if is_leaf_surface:
				_foliage_surfaces.append({
					"mesh": mesh_node,
					"surface": surface,
					"orig": mesh_node.get_surface_override_material(surface),
				})
			else:
				_register_surface_next_pass(mesh_node, surface, _branch_frost_pass)


func _register_surface_override(mesh_node: MeshInstance3D, surface: int, winter_mat: Material) -> void:
	_outdoor_overrides.append({
		"mesh": mesh_node,
		"surface": surface,
		"orig": mesh_node.get_surface_override_material(surface),
		"winter": winter_mat,
		"is_next_pass": false,
	})


func _register_next_pass(mesh_node: MeshInstance3D, pass_mat: Material) -> void:
	for surface in mesh_node.mesh.get_surface_count():
		_register_surface_next_pass(mesh_node, surface, pass_mat)


func _register_surface_next_pass(mesh_node: MeshInstance3D, surface: int, pass_mat: Material) -> void:
	var existing := mesh_node.get_surface_override_material(surface)
	var base := existing if existing != null else mesh_node.mesh.surface_get_material(surface)
	if base == null: return
	# Если на материале уже сидит override (например БЦ Асгард), вешаем next_pass прямо на него,
	# чтобы не сломать переключение дневных/ночных текстур.
	if existing != null:
		_outdoor_overrides.append({
			"material": existing,
			"orig_next_pass": existing.next_pass,
			"winter_pass": pass_mat,
			"is_next_pass": true,
		})
	else:
		var dup := base.duplicate() as Material
		dup.next_pass = pass_mat
		_outdoor_overrides.append({
			"mesh": mesh_node,
			"surface": surface,
			"orig": null,
			"winter": dup,
			"is_next_pass": false,
		})


func _build_snowdrifts() -> void:
	# Умеренные сугробы вдоль газонов, у ограды и возле стволов деревьев —
	# территория чистится, поэтому проезды и дорожки остаются свободными.
	_snow_root = Node3D.new()
	_snow_root.name = "Зимние_сугробы"
	add_child(_snow_root)

	var drift_mat := StandardMaterial3D.new()
	drift_mat.albedo_color = Color(0.90, 0.93, 0.97)
	drift_mat.roughness = 0.84

	var sphere := SphereMesh.new()
	sphere.radial_segments = 16
	sphere.rings = 8
	sphere.radius = 1.0
	sphere.height = 1.0

	# [позиция (x, z), масштаб (длина x, высота y, ширина z), поворот по Y]
	var specs := [
		# Умеренные отвалы снега вдоль ближней бровки газона за окном
		[Vector2(10.8, -6.5), Vector3(3.4, 0.34, 1.5), 0.12],
		[Vector2(11.4, -1.2), Vector3(2.8, 0.30, 1.3), -0.08],
		[Vector2(11.0, 4.8), Vector3(3.2, 0.36, 1.6), 0.18],
		[Vector2(16.5, -11.5), Vector3(4.2, 0.42, 1.8), 0.05],
		[Vector2(17.2, 9.5), Vector3(3.8, 0.38, 1.7), -0.15],
		# Сугробы у оснований елей и у ограды двора
		[Vector2(22.0, -14.0), Vector3(3.6, 0.44, 2.2), 0.25],
		[Vector2(24.5, -8.5), Vector3(3.2, 0.38, 1.9), -0.20],
		[Vector2(23.5, 13.8), Vector3(4.0, 0.45, 2.1), 0.10],
		[Vector2(30.0, -18.5), Vector3(4.6, 0.48, 2.2), 0.04],
		[Vector2(35.0, -18.0), Vector3(4.4, 0.44, 2.0), -0.06],
		# Приствольные сугробы у процедурных деревьев во дворе
		[Vector2(46.0, 8.0), Vector3(3.2, 0.40, 3.0), 0.3],
		[Vector2(45.0, -30.0), Vector3(3.4, 0.42, 3.1), -0.4],
	]

	for item in specs:
		var xz: Vector2 = item[0]
		var sc: Vector3 = item[1]
		var rot_y: float = item[2]
		var mound := MeshInstance3D.new()
		mound.mesh = sphere
		mound.material_override = drift_mat
		mound.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mound.position = Vector3(xz.x, _ground_y - sc.y * 0.12, xz.y)
		mound.scale = sc
		mound.rotation.y = rot_y
		_snow_root.add_child(mound)


func _build_snowfall() -> void:
	# Мягкая круглая снежинка через процедурную текстуру.
	var img := Image.create(16, 16, false, Image.FORMAT_RGBA8)
	for y in 16:
		for x in 16:
			var dx := (float(x) - 7.5) / 7.5
			var dy := (float(y) - 7.5) / 7.5
			var dist := sqrt(dx * dx + dy * dy)
			var alpha := clampf(1.0 - smoothstep(0.25, 1.0, dist), 0.0, 1.0)
			img.set_pixel(x, y, Color(1.0, 1.0, 1.0, alpha * 0.82))
	var flake_tex := ImageTexture.create_from_image(img)

	var flake_mat := StandardMaterial3D.new()
	flake_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	flake_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	flake_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	flake_mat.albedo_texture = flake_tex
	flake_mat.albedo_color = Color(0.92, 0.95, 1.0, 0.85)
	flake_mat.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED

	var quad := QuadMesh.new()
	quad.size = Vector2(0.036, 0.036)
	quad.material = flake_mat

	# Ближний слой снегопада строго за стеклом лоджии (min x = 14.5 - 7.4 = 7.1 > 6.60).
	_snowfall_near = _create_snow_emitter("Снегопад_ближний", Vector3(15.3, 4.5, -1.6), Vector3(7.4, 5.2, 11.0), 220, 9.0, quad)
	# Дальний слой для глубины двора.
	_snowfall_far = _create_snow_emitter("Снегопад_дальний", Vector3(29.0, 6.5, -4.0), Vector3(12.0, 7.5, 22.0), 180, 12.0, quad)


func _create_snow_emitter(label: String, pos: Vector3, extents: Vector3, count: int, life: float, draw_mesh: Mesh) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.name = label
	p.position = pos
	p.amount = count
	p.lifetime = life
	p.preprocess = life * 0.7
	p.visibility_aabb = AABB(-extents - Vector3(4, 14, 4), extents * 2.0 + Vector3(8, 22, 8))
	p.draw_pass_1 = draw_mesh
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = extents
	pm.direction = Vector3(0.18, -1.0, 0.12)
	pm.spread = 22.0
	pm.initial_velocity_min = 0.25
	pm.initial_velocity_max = 0.55
	pm.gravity = Vector3(0.12, -0.45, 0.08)
	pm.scale_min = 0.65
	pm.scale_max = 1.35
	p.process_material = pm

	add_child(p)
	return p


func _build_garlands() -> void:
	_garland_root = Node3D.new()
	_garland_root.name = "Гирлянды"
	add_child(_garland_root)

	# 4 общих канала материалов для плавного мерцания/волны без нагрузки на FPS.
	for i in 4:
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(0.95, 0.92, 0.85)
		mat.roughness = 0.25
		mat.emission_enabled = true
		mat.emission = Color(1.0, 0.78, 0.40)
		mat.emission_energy_multiplier = 2.6
		_garland_channel_mats.append(mat)

	var wire_mat := StandardMaterial3D.new()
	wire_mat.albedo_color = Color(0.10, 0.12, 0.11)
	wire_mat.roughness = 0.85

	var bulb_mesh := SphereMesh.new()
	bulb_mesh.radius = 0.013
	bulb_mesh.height = 0.028
	bulb_mesh.radial_segments = 8
	bulb_mesh.rings = 5

	# Кровать у стола (стена z = 0.0 -> отступ в комнату z = -0.024, x: 2.32 .. 4.40)
	_build_garland_strand(2.32, 4.40, -0.024, 1.48, 0.20, 3, 28, wire_mat, bulb_mesh)
	# Кровать у лоджии (стена z = -3.20 -> отступ в комнату z = -3.176, x: 2.32 .. 4.40)
	_build_garland_strand(2.32, 4.40, -3.176, 1.48, 0.20, 3, 28, wire_mat, bulb_mesh)

	# Два мягких источника света над кроватями без теней (чтобы не просаживать FPS).
	for at in [Vector3(3.36, 1.38, -0.34), Vector3(3.36, 1.38, -2.86)]:
		var light := OmniLight3D.new()
		light.position = at
		light.light_color = Color(1.0, 0.78, 0.42)
		light.light_energy = 0.22
		light.omni_range = 2.6
		light.shadow_enabled = false
		_garland_root.add_child(light)
		_garland_lights.append(light)


func _build_garland_strand(
	x_start: float,
	x_end: float,
	wall_z: float,
	anchor_y: float,
	sag: float,
	swags: int,
	bulb_count: int,
	wire_mat: StandardMaterial3D,
	bulb_mesh: SphereMesh
) -> void:
	var wire_steps := swags * 18
	var points: PackedVector3Array = []
	for i in range(wire_steps + 1):
		var t := float(i) / float(wire_steps)
		var x := lerpf(x_start, x_end, t)
		var local_t := fmod(t * float(swags), 1.0)
		if i == wire_steps: local_t = 1.0
		var y := anchor_y - 4.0 * sag * local_t * (1.0 - local_t)
		points.append(Vector3(x, y, wall_z))

	# Тонкий провисший провод (лента из треугольников, видимая с обеих сторон).
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half_w := 0.004
	for i in range(points.size() - 1):
		var a := points[i]
		var b := points[i + 1]
		var up := Vector3(0.0, half_w, 0.0)
		st.add_vertex(a - up)
		st.add_vertex(b - up)
		st.add_vertex(b + up)
		st.add_vertex(a - up)
		st.add_vertex(b + up)
		st.add_vertex(a + up)
	st.generate_normals()
	var wire_node := MeshInstance3D.new()
	wire_node.mesh = st.commit()
	var double_wire := wire_mat.duplicate() as StandardMaterial3D
	double_wire.cull_mode = BaseMaterial3D.CULL_DISABLED
	wire_node.material_override = double_wire
	wire_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_garland_root.add_child(wire_node)

	# Лампочки вдоль кривой, распределённые по 4 цветовым каналам.
	for i in bulb_count:
		var t := (float(i) + 0.5) / float(bulb_count)
		var x := lerpf(x_start, x_end, t)
		var local_t := fmod(t * float(swags), 1.0)
		var y := anchor_y - 4.0 * sag * local_t * (1.0 - local_t) - 0.016
		var bulb := MeshInstance3D.new()
		bulb.mesh = bulb_mesh
		bulb.material_override = _garland_channel_mats[i % 4]
		bulb.position = Vector3(x, y, wall_z)
		bulb.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_garland_root.add_child(bulb)


func set_enabled(value: bool) -> void:
	enabled = value
	# 1. Снежные материалы улицы
	for item in _outdoor_overrides:
		if item.is_next_pass:
			var mat: Material = item.material
			mat.next_pass = item.winter_pass if enabled else item.orig_next_pass
		else:
			var mesh_node: MeshInstance3D = item.mesh
			mesh_node.set_surface_override_material(item.surface, item.winter if enabled else item.orig)

	# 2. Убираем листву деревьев на зиму
	for node in _foliage_nodes:
		node.visible = not enabled
	for item in _foliage_surfaces:
		var mesh_node: MeshInstance3D = item.mesh
		mesh_node.set_surface_override_material(item.surface, _hidden_foliage_mat if enabled else item.orig)

	# 3. Сугробы, снегопад и гирлянды
	if _snow_root != null:
		_snow_root.visible = enabled
	if _snowfall_near != null:
		_snowfall_near.visible = enabled
		_snowfall_near.emitting = enabled
	if _snowfall_far != null:
		_snowfall_far.visible = enabled
		_snowfall_far.emitting = enabled
	if _garland_root != null:
		_garland_root.visible = enabled

	# 4. Адаптация неба и освещения
	if room != null:
		apply_lighting(room.lighting_mode)
	_update_garland_visuals(0.0)


func apply_lighting(mode: int) -> void:
	if room == null or room.room_environment == null: return
	if not _saved_lighting:
		_orig_ambient_color = room.room_environment.ambient_light_color
		for light in room.daylight:
			if light is DirectionalLight3D:
				_orig_sun_color = light.light_color
				_orig_sun_energy = light.light_energy
			else:
				_orig_window_colors[light] = light.light_color
		_saved_lighting = true

	if room.sky_material != null:
		room.sky_material.set_shader_parameter("winter_amount", 1.0 if enabled else 0.0)

	var day_ambient: float = 0.18 if room.daylight_prototype else 0.28
	if enabled:
		var winter_ambients := [day_ambient + 0.05, 0.095, 0.028]
		var winter_colors := [
			Color(0.79, 0.86, 0.95),
			Color(0.68, 0.76, 0.90),
			Color(0.56, 0.68, 0.88),
		]
		room.room_environment.ambient_light_energy = winter_ambients[mode]
		room.room_environment.ambient_light_color = winter_colors[mode]
		for light in room.daylight:
			if light is DirectionalLight3D:
				light.light_color = Color(0.84, 0.91, 1.0)
				light.light_energy = _orig_sun_energy * 0.82
			elif _orig_window_colors.has(light):
				light.light_color = Color(0.88, 0.94, 1.0)
	else:
		room.room_environment.ambient_light_energy = [day_ambient, 0.08, 0.015][mode]
		room.room_environment.ambient_light_color = _orig_ambient_color
		for light in room.daylight:
			if light is DirectionalLight3D:
				light.light_color = _orig_sun_color
				light.light_energy = _orig_sun_energy
			elif _orig_window_colors.has(light):
				light.light_color = _orig_window_colors[light]

	# Подстраиваем яркость снежинок под время суток, чтобы ночью они не светились как неон.
	if _snowfall_near != null and _snowfall_near.draw_pass_1 != null:
		var quad := _snowfall_near.draw_pass_1 as QuadMesh
		if quad != null and quad.material is StandardMaterial3D:
			var flake_mat := quad.material as StandardMaterial3D
			var flake_tints := [
				Color(0.94, 0.96, 1.0, 0.85),
				Color(0.62, 0.68, 0.82, 0.78),
				Color(0.30, 0.36, 0.48, 0.68),
			]
			flake_mat.albedo_color = flake_tints[mode]


func set_garland_mode(mode_idx: int) -> void:
	garland_mode = clampi(mode_idx, 0, GARLAND_MODES.size() - 1)
	_update_garland_visuals(0.0)


func set_garland_brightness(value: float) -> void:
	garland_brightness = clampf(value, 0.1, 1.0)
	_update_garland_visuals(0.0)


func set_garland_on(value: bool) -> void:
	garland_on = value
	_update_garland_visuals(0.0)


func _process(delta: float) -> void:
	if not enabled: return
	_anim_time += delta
	_update_garland_visuals(_anim_time)


func _update_garland_visuals(t: float) -> void:
	if _garland_channel_mats.is_empty(): return
	var active := enabled and garland_on
	var avg_color := Color.BLACK
	var avg_intensity := 0.0

	for i in 4:
		var mat := _garland_channel_mats[i]
		if not active:
			mat.emission_enabled = false
			mat.albedo_color = Color(0.45, 0.45, 0.44)
			continue

		var col := Color(1.0, 0.78, 0.40)
		var pulse := 1.0
		match garland_mode:
			0: # Тёплый свет
				col = Color(1.0, 0.78, 0.40)
				pulse = 1.0
			1: # Разноцветный
				col = MULTI_COLORS[i]
				pulse = 1.0
			2: # Мягкое дыхание
				col = Color(1.0, 0.75, 0.36)
				pulse = 0.45 + 0.55 * (0.5 + 0.5 * sin(t * 1.9))
			3: # Мерцание
				col = MULTI_COLORS[i]
				pulse = 0.30 + 0.70 * (0.5 + 0.5 * sin(t * 3.1 + float(i) * 1.57))
			4: # Бегущие огоньки
				col = MULTI_COLORS[i]
				var wave := sin(t * 4.2 - float(i) * 1.57)
				pulse = 0.18 + 0.82 * pow(maxf(0.0, wave), 1.4)
			5: # Зимний лёд
				col = FROST_COLORS[i]
				pulse = 0.45 + 0.55 * (0.5 + 0.5 * sin(t * 2.6 + float(i) * 1.25))

		var energy := 2.8 * garland_brightness * pulse
		mat.emission_enabled = true
		mat.albedo_color = col.lerp(Color.WHITE, 0.35)
		mat.emission = col.lerp(Color.WHITE, 0.22)
		mat.emission_energy_multiplier = energy
		avg_color += col * pulse
		avg_intensity += pulse

	for light in _garland_lights:
		light.visible = active
		if active and avg_intensity > 0.001:
			light.light_color = avg_color / avg_intensity
			light.light_energy = 0.24 * garland_brightness * (avg_intensity / 4.0)
