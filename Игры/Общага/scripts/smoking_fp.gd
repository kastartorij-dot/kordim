extends Node3D

@export var model_scene: PackedScene = preload("res://models/руки_сигарета.glb")
enum State { HIDDEN, DRAWING, PACK, EXTRACTING, UNLIT, LIGHTING, LIT, DRAGGING, FLICKING }

var _state: State = State.HIDDEN
var _rig: Node3D
var _anim: AnimationPlayer
var _ember_node: Node3D
var _flame_node: Node3D
var _ember_light: OmniLight3D
var _flame_light: OmniLight3D
var _smoke_wisp: CPUParticles3D
var _smoke_exhale: CPUParticles3D
var _ash_particles: CPUParticles3D
var _t := 0.0
var _ash_released := false
var _exhale_released := false
var _ember_material: StandardMaterial3D


func _ready() -> void:
	_rig = model_scene.instantiate()
	_rig.rotation_degrees.y = 180.0
	_rig.visible = false
	add_child(_rig)
	var camera_anchor := _rig.find_child("точка_камеры", true, false) as Node3D
	_rig.position -= to_local(camera_anchor.global_position)

	_anim = _rig.find_child("AnimationPlayer", true, false) as AnimationPlayer
	_anim.animation_finished.connect(_on_anim_finished)
	for clip in ["покой_пачка", "покой_неподожжённая", "покой_курение"]:
		_anim.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
	_ember_node = _rig.find_child("уголёк_торец", true, false) as Node3D
	_flame_node = _rig.find_child("пламя_узел", true, false) as Node3D
	var ember_mesh := _rig.find_child("уголёк", true, false) as MeshInstance3D
	_ember_material = ember_mesh.get_active_material(0).duplicate() as StandardMaterial3D
	_ember_material.emission_enabled = true
	_ember_material.emission = Color(1.0, 0.24, 0.03)
	ember_mesh.set_surface_override_material(0, _ember_material)
	_setup_fx()


func _setup_fx() -> void:
	# Свет уголька крепится прямо к узлу уголька, чтобы точно следовать за рукой
	_ember_light = OmniLight3D.new()
	_ember_light.light_color = Color(1.0, 0.34, 0.06)
	_ember_light.light_energy = 0.0
	_ember_light.omni_range = 0.45
	_ember_node.add_child(_ember_light)

	# Свет пламени крепится прямо к узлу пламени зажигалки
	_flame_light = OmniLight3D.new()
	_flame_light.light_color = Color(1.0, 0.62, 0.18)
	_flame_light.light_energy = 0.0
	_flame_light.omni_range = 0.28
	_flame_node.get_parent().add_child(_flame_light)
	_flame_light.position = _flame_node.position

	# 1. Тонкая постоянная струйка дыма от уголька
	_smoke_wisp = _make_smoke_particles(28, 1.9, 0.010, 0.048, Vector3(0, 1, 0), 14.0, 0.14, 0.24, 0.24)
	_ember_node.add_child(_smoke_wisp)

	# 2. Облако выдоха вперёд от камеры после затяжки
	_smoke_exhale = _make_smoke_particles(22, 1.6, 0.04, 0.16, Vector3(0, 0.15, -1), 24.0, 0.45, 0.85, 0.20)
	_smoke_exhale.one_shot = true
	_smoke_exhale.explosiveness = 0.65
	_smoke_exhale.position = Vector3(0.0, -0.10, -0.25)
	add_child(_smoke_exhale)

	# 3. Крошки пепла при стряхивании
	_ash_particles = CPUParticles3D.new()
	_ash_particles.amount = 10
	_ash_particles.lifetime = 0.85
	_ash_particles.one_shot = true
	_ash_particles.explosiveness = 0.85
	_ash_particles.emitting = false
	_ash_particles.direction = Vector3(0, -1, 0)
	_ash_particles.spread = 35.0
	_ash_particles.initial_velocity_min = 0.08
	_ash_particles.initial_velocity_max = 0.22
	_ash_particles.gravity = Vector3(0, -2.8, 0)
	_ash_particles.scale_amount_min = 0.0025
	_ash_particles.scale_amount_max = 0.0055
	var amesh := BoxMesh.new()
	amesh.size = Vector3.ONE
	var amat := StandardMaterial3D.new()
	amat.albedo_color = Color(0.32, 0.31, 0.30)
	amesh.material = amat
	_ash_particles.mesh = amesh
	_ember_node.add_child(_ash_particles)


func _make_smoke_particles(amount: int, lifetime: float, smin: float, smax: float,
		dir: Vector3, spread: float, vmin: float, vmax: float, alpha: float) -> CPUParticles3D:
	var p := CPUParticles3D.new()
	p.amount = amount
	p.lifetime = lifetime
	p.emitting = false
	p.direction = dir.normalized()
	p.spread = spread
	p.initial_velocity_min = vmin
	p.initial_velocity_max = vmax
	p.gravity = Vector3(0.0, 0.08, 0.0)
	p.scale_amount_min = smin
	p.scale_amount_max = smax

	var mesh := QuadMesh.new()
	mesh.size = Vector2.ONE
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color.WHITE, Color(1, 1, 1, 0)])
	gradient.interpolation_mode = Gradient.GRADIENT_INTERPOLATE_CUBIC
	var texture := GradientTexture2D.new()
	texture.width = 32
	texture.height = 32
	texture.gradient = gradient
	texture.fill = GradientTexture2D.FILL_RADIAL
	texture.fill_from = Vector2(0.5, 0.5)
	texture.fill_to = Vector2(1.0, 0.5)
	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.billboard_keep_scale = true
	mat.vertex_color_use_as_albedo = true
	mat.albedo_texture = texture
	mat.albedo_color = Color(0.86, 0.88, 0.92, alpha)
	mesh.material = mat
	p.mesh = mesh
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var fade := Gradient.new()
	fade.offsets = PackedFloat32Array([0.0, 0.18, 1.0])
	fade.colors = PackedColorArray([Color(1, 1, 1, 0.45), Color.WHITE, Color(1, 1, 1, 0)])
	p.color_ramp = fade
	return p


func handle_event(event: InputEvent) -> bool:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if _state == State.LIT:
			_exhale_released = false
			_play(State.DRAGGING, &"затяжка", 0.12)
			return true
		return _state in [State.DRAGGING, State.FLICKING]
	if not (event is InputEventKey and event.pressed and not event.echo):
		return false
	match event.physical_keycode:
		KEY_1:
			if _state == State.HIDDEN:
				_rig.show()
				_t = 0.0
				_play(State.DRAWING, &"достать_пачку")
			return true
		KEY_E:
			if _state == State.PACK:
				_play(State.EXTRACTING, &"вынуть_сигарету", 0.12)
				return true
			if _state == State.UNLIT:
				_play(State.LIGHTING, &"поджечь_сигарету", 0.12)
				return true
			return _state in [State.DRAWING, State.EXTRACTING, State.LIGHTING]
		KEY_G:
			if _state == State.LIT:
				_ash_released = false
				_play(State.FLICKING, &"стряхнуть_пепел", 0.12)
				return true
		KEY_C:
			if _state != State.HIDDEN:
				put_away()
				return true
	return false


func _play(next: State, clip: StringName, blend := 0.0) -> void:
	_state = next
	_anim.play(clip, blend)
	_anim.advance(0.0)


func put_away() -> void:
	_state = State.HIDDEN
	_anim.stop()
	_rig.hide()
	_ember_light.light_energy = 0.0
	_ember_material.emission_energy_multiplier = 0.0
	_flame_light.light_energy = 0.0
	for particles in [_smoke_wisp, _smoke_exhale, _ash_particles]:
		particles.emitting = false
		particles.hide()


func _on_anim_finished(_clip: StringName) -> void:
	match _state:
		State.DRAWING:
			_play(State.PACK, &"покой_пачка")
		State.EXTRACTING:
			_play(State.UNLIT, &"покой_неподожжённая")
		State.LIGHTING, State.DRAGGING, State.FLICKING:
			_state = State.LIT
			_anim.play("покой_курение")


func _process(delta: float) -> void:
	if _state == State.HIDDEN:
		return
	_t += delta
	var pos := _anim.current_animation_position

	if _state == State.FLICKING and not _ash_released and pos >= 11.0 / 24.0:
		_ash_released = true
		_ash_particles.show()
		_ash_particles.restart()

	if _state == State.DRAGGING and not _exhale_released and pos >= 49.0 / 24.0:
		_exhale_released = true
		_smoke_exhale.show()
		_smoke_exhale.restart()

	if _state == State.LIGHTING and pos >= 24.0 / 24.0 and pos <= 47.0 / 24.0:
		_flame_light.light_energy = 0.13 + 0.03 * sin(_t * 46.0) + 0.015 * cos(_t * 73.0)
	else:
		_flame_light.light_energy = 0.0

	# Свечение уголька и тонкий дымок
	var lit := _state in [State.LIT, State.DRAGGING, State.FLICKING] or (_state == State.LIGHTING and pos >= 1.35)
	_smoke_wisp.visible = lit
	_smoke_wisp.emitting = lit
	var glow := 0.0
	if lit:
		glow = 0.48 + 0.09 * sin(_t * 10.0)
		if _state == State.DRAGGING and pos >= 0.70 and pos <= 1.65:
			glow = 1.65 + 0.18 * sin(_t * 22.0)
	_ember_material.emission_energy_multiplier = glow
	_ember_light.light_energy = glow * 0.035
