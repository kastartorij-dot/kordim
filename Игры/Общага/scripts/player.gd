extends CharacterBody3D
## Базовая ходьба: капсула, гравитация, прыжок, мышь. Без полёта через мебель.

const WALK_SPEED := 1.8
const RUN_SPEED := 3.5
const JUMP_SPEED := 3.6
const EYE_HEIGHT := 1.62

var camera: Camera3D
var jump_queued := false

func _ready() -> void:
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.20
	capsule.height = 1.72
	shape.shape = capsule
	shape.position.y = 0.86
	add_child(shape)
	floor_snap_length = 0.12
	floor_max_angle = deg_to_rad(45)
	safe_margin = 0.005

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif event is InputEventKey and event.pressed:
		if event.physical_keycode == KEY_ESCAPE:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		elif event.physical_keycode == KEY_SPACE and not event.echo:
			jump_queued = true
		elif event.physical_keycode == KEY_F11:
			var fullscreen := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if fullscreen else DisplayServer.WINDOW_MODE_FULLSCREEN)
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED and camera != null:
		rotation.y -= event.relative.x * 0.0025
		camera.rotation.x = clampf(camera.rotation.x - event.relative.y * 0.0025, -1.45, 1.45)

func _key(a: Key, b: Key) -> float:
	return float(Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b))

func _physics_process(delta: float) -> void:
	var direction := Vector3.ZERO
	if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		direction = basis * Vector3(_key(KEY_D, KEY_RIGHT) - _key(KEY_A, KEY_LEFT), 0,
			_key(KEY_S, KEY_DOWN) - _key(KEY_W, KEY_UP))
	var speed := RUN_SPEED if Input.is_physical_key_pressed(KEY_SHIFT) else WALK_SPEED
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
		position = Vector3(0.75, 0.1, -1.6)
		velocity = Vector3.ZERO
