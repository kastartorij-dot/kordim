extends CharacterBody3D
## Базовая ходьба: капсула, гравитация, прыжок, мышь. Без полёта через мебель.

const WALK_SPEED := 1.8
const RUN_SPEED := 3.5
const JUMP_SPEED := 3.6
const EYE_HEIGHT := 1.62

var camera: Camera3D
var jump_queued := false
var ignore_capture_motion := false
var body_shape: CollisionShape3D
var crouched := false
var resting := ""
var return_transform := Transform3D.IDENTITY

func _ready() -> void:
	collision_layer = 4
	collision_mask = 3
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.20
	capsule.height = 1.72
	body_shape = shape
	shape.shape = capsule
	shape.position.y = 0.86
	add_child(shape)
	floor_snap_length = 0.12
	floor_max_angle = deg_to_rad(45)
	safe_margin = 0.005

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			ignore_capture_motion = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode == KEY_SPACE and not event.echo:
			if not resting.is_empty(): leave_rest()
			else: jump_queued = true
		elif event.physical_keycode == KEY_F11:
			var fullscreen := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if fullscreen else DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and camera != null:
		if ignore_capture_motion:
			ignore_capture_motion = false
			return
		rotation.y -= event.relative.x * 0.0025
		camera.rotation.x = clampf(camera.rotation.x - event.relative.y * 0.0025, -1.45, 1.45)

func _key(a: Key, b: Key) -> float:
	return float(Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b))

func can_stand_at(at: Transform3D) -> bool:
	var query := PhysicsShapeQueryParameters3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.20
	capsule.height = 1.72
	query.shape = capsule
	query.transform = at * Transform3D(Basis.IDENTITY, Vector3(0, 0.88, 0))
	query.collision_mask = 3
	query.exclude = [get_rid()]
	query.margin = 0.002
	return get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty()

func set_crouched(value: bool) -> bool:
	if value == crouched: return true
	if not value and crouched and not can_stand_at(global_transform): return false
	crouched = value
	var capsule := body_shape.shape as CapsuleShape3D
	capsule.height = 1.05 if crouched else 1.72
	body_shape.position.y = capsule.height / 2
	return true

func start_rest(kind: String, at: Vector3, target: Vector3) -> void:
	if not resting.is_empty(): return
	return_transform = global_transform
	resting = kind
	velocity = Vector3.ZERO
	jump_queued = false
	body_shape.set_deferred("disabled", true)
	global_position = at + (Vector3(0.65, 0, 0) if kind == "bed" else Vector3.ZERO)
	look_at(Vector3(target.x, global_position.y, target.z))
	camera.position = Vector3(0, 1.12 if kind == "chair" else 0.72, 0)
	camera.look_at(target)

func leave_rest() -> bool:
	if resting.is_empty(): return true
	var exit := return_transform
	if not can_stand_at(exit):
		# Вставание из кресла: сохранённая точка могла оказаться впритык к мебели.
		# Ищем ближайшее свободное место вокруг точки, где игрок сел.
		for distance in [0.15, 0.30, 0.45]:
			for direction in [Vector3.LEFT, Vector3.RIGHT, Vector3.FORWARD, Vector3.BACK]:
				var candidate := return_transform.translated(direction * distance)
				if can_stand_at(candidate):
					exit = candidate
					break
			if exit != return_transform: break
		if exit == return_transform: return false
	global_transform = exit
	reset_posture()
	return true

func reset_posture() -> void:
	resting = ""
	crouched = false
	jump_queued = false
	velocity = Vector3.ZERO
	var capsule := body_shape.shape as CapsuleShape3D
	capsule.height = 1.72
	body_shape.position.y = 0.86
	body_shape.set_deferred("disabled", false)
	camera.position = Vector3(0, EYE_HEIGHT, 0)
	camera.rotation.x = 0

func _physics_process(delta: float) -> void:
	if not resting.is_empty(): return
	set_crouched(Input.is_physical_key_pressed(KEY_CTRL))
	camera.position.y = move_toward(camera.position.y, 0.95 if crouched else EYE_HEIGHT, delta * 4)
	var direction := Vector3.ZERO
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		direction = basis * Vector3(_key(KEY_D, KEY_RIGHT) - _key(KEY_A, KEY_LEFT), 0,
			_key(KEY_S, KEY_DOWN) - _key(KEY_W, KEY_UP))
	var speed := 0.8 if crouched else (RUN_SPEED if Input.is_physical_key_pressed(KEY_SHIFT) else WALK_SPEED)
	velocity.x = move_toward(velocity.x, direction.normalized().x * speed, 12 * delta)
	velocity.z = move_toward(velocity.z, direction.normalized().z * speed, 12 * delta)
	if is_on_floor():
		if jump_queued and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			velocity.y = JUMP_SPEED
	else:
		velocity.y -= 9.8 * delta
	jump_queued = false
	move_and_slide()
	if position.y < -4:
		position = Vector3(1.05, 0.08, -1.6)
		velocity = Vector3.ZERO
