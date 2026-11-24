extends SceneTree


func _initialize() -> void:
	call_deferred("_check")


func _check() -> void:
	var room = load("res://scenes/dorm.tscn").instantiate()
	root.add_child(room)
	await process_frame
	var hands = room.camera.get_node("Руки")
	var use_window := DisplayServer.get_name() != "headless"
	room.player.set_process_unhandled_input(false)
	var states = hands.State
	var animation: AnimationPlayer = hands._anim
	assert(hands._state == states.HIDDEN and not hands._rig.visible)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_press(hands, KEY_1, true)
	assert(hands._state == states.HIDDEN)
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_press(hands, KEY_1, use_window)
	assert(hands._state == states.DRAWING and hands._rig.visible)
	_press(hands, KEY_E, use_window)
	assert(hands._state == states.DRAWING)
	animation.advance(2.0)
	assert(hands._state == states.PACK)
	await _shot("smoking-real-pack")
	_press(hands, KEY_E, use_window)
	assert(hands._state == states.EXTRACTING)
	animation.advance(3.0)
	assert(hands._state == states.UNLIT)
	assert(not hands._smoke_wisp.emitting)
	await _shot("smoking-real-unlit")
	_press(hands, KEY_E, use_window)
	assert(hands._state == states.LIGHTING)
	animation.advance(1.50)
	hands._process(0.0)
	assert(hands._flame_light.light_energy > 0.0 and hands._smoke_wisp.emitting)
	await process_frame
	await process_frame
	var flame: Node3D = hands._rig.find_child("пламя_вершина", true, false)
	var ember: Node3D = hands._rig.find_child("уголёк_торец", true, false)
	assert(flame.global_position.distance_to(ember.global_position) < 0.014)
	await _shot("smoking-real-light")
	_press(hands, KEY_C, use_window)
	assert(hands._state == states.HIDDEN and not animation.is_playing())
	assert(not hands._smoke_wisp.emitting and hands._flame_light.light_energy == 0.0)
	_press(hands, KEY_1, use_window)
	assert(animation.current_animation_position < 0.1)
	animation.advance(2.0)
	_press(hands, KEY_E, use_window)
	animation.advance(3.0)
	_press(hands, KEY_E, use_window)
	animation.advance(4.0)
	assert(hands._state == states.LIT)
	animation.advance(4.0)
	assert(animation.is_playing() and animation.current_animation == "покой_курение")
	await _shot("smoking-real-idle")
	var click := InputEventMouseButton.new()
	click.button_index = MOUSE_BUTTON_LEFT
	click.pressed = true
	_send(hands, click, use_window)
	assert(hands._state == states.DRAGGING)
	animation.advance(1.1)
	hands._process(0.0)
	assert(hands._ember_material.emission_energy_multiplier > 1.0)
	assert(not hands._smoke_exhale.emitting)
	await process_frame
	await process_frame
	var filter: Node3D = hands._rig.find_child("фильтр_торец", true, false)
	var mouth := Vector3(0.0, -0.094, -0.017)
	assert(mouth.distance_to(room.camera.to_local(filter.global_position)) < 0.024)
	await _shot("smoking-real-drag")
	animation.advance(1.05)
	hands._process(0.0)
	assert(hands._smoke_exhale.emitting)
	if use_window:
		await create_timer(0.35).timeout
		await _shot("smoking-real-exhale")
	animation.advance(1.0)
	assert(hands._state == states.LIT)
	_press(hands, KEY_G, use_window)
	assert(hands._state == states.FLICKING and not hands._ash_particles.emitting)
	animation.advance(0.6)
	hands._process(0.0)
	assert(hands._ash_particles.emitting)
	animation.advance(2.0)
	assert(hands._state == states.LIT)
	_press(hands, KEY_C, use_window)
	assert(hands._state == states.HIDDEN and not hands._rig.visible)
	assert(not hands._smoke_exhale.visible and not hands._ash_particles.visible)
	var save_path := "user://test-smoking.cfg"
	assert(room.save_walk(save_path) == OK)
	_press(hands, KEY_1, use_window)
	assert(room.load_walk(save_path) == OK)
	assert(hands._state == states.HIDDEN)
	DirAccess.remove_absolute(save_path)
	print("OK: пачка, сигарета, поджигание, затяжка, пепел и сброс")
	quit()


func _press(hands: Node3D, key: Key, dispatch: bool) -> void:
	var event := InputEventKey.new()
	event.physical_keycode = key
	event.pressed = true
	_send(hands, event, dispatch)


func _send(hands: Node3D, event: InputEvent, dispatch: bool) -> void:
	if dispatch:
		root.push_input(event)
	else:
		hands.handle_event(event)


func _shot(filename: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://shots/%s.png" % filename)
