extends SceneTree


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var room = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(room)
	await process_frame
	var hands = room.camera.get_node("Руки")
	var use_window := DisplayServer.get_name() != "headless"
	var states = hands.State
	var animation: AnimationPlayer = hands._anim
	assert(hands._state == states.HIDDEN and not hands._rig.visible)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_press(hands, KEY_C, true)
	assert(hands._state == states.HIDDEN)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_press(hands, KEY_C, use_window)
	assert(hands._state == states.LIGHTING and hands._rig.visible)
	_press(hands, KEY_F, use_window)
	assert(hands._state == states.LIGHTING)
	animation.advance(1.95)
	hands._process(0.0)
	assert(hands._flame_light.light_energy > 0.0 and hands._smoke_wisp.emitting)
	await _shot("smoking-light")
	_press(hands, KEY_C, use_window)
	assert(hands._state == states.HIDDEN and not animation.is_playing())
	assert(not hands._smoke_wisp.emitting and hands._flame_light.light_energy == 0.0)
	_press(hands, KEY_C, use_window)
	assert(animation.current_animation_position < 0.1)
	animation.advance(4.0)
	assert(hands._state == states.IDLE)
	animation.advance(4.0)
	assert(animation.is_playing() and animation.current_animation == "покой_курение")
	await _shot("smoking-idle")
	_press(hands, KEY_F, use_window)
	assert(hands._state == states.DRAGGING)
	animation.advance(1.1)
	hands._process(0.0)
	assert(hands._ember_material.emission_energy_multiplier > 1.0)
	await _shot("smoking-drag")
	animation.advance(3.0)
	assert(hands._state == states.IDLE and hands._smoke_exhale.emitting)
	if use_window:
		await create_timer(0.35).timeout
		await _shot("smoking-exhale")
	_press(hands, KEY_G, use_window)
	assert(hands._state == states.FLICKING and not hands._ash_particles.emitting)
	animation.advance(0.6)
	hands._process(0.0)
	assert(hands._ash_particles.emitting)
	animation.advance(2.0)
	assert(hands._state == states.IDLE)
	_press(hands, KEY_C, use_window)
	assert(hands._state == states.HIDDEN and not hands._rig.visible)
	assert(not hands._smoke_exhale.visible and not hands._ash_particles.visible)
	var save_path := "user://test-smoking.cfg"
	assert(room.save_walk(save_path) == OK)
	_press(hands, KEY_C, use_window)
	assert(room.load_walk(save_path) == OK)
	assert(hands._state == states.HIDDEN)
	DirAccess.remove_absolute(save_path)
	print("OK: руки, поджигание, затяжка, пепел и повторный запуск")
	quit()


func _press(hands: Node3D, key: Key, dispatch: bool) -> void:
	if not dispatch:
		hands.handle_key(key)
		return
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.pressed = true
	root.push_input(event)


func _shot(filename: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://shots/%s.png" % filename)
