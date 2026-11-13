extends CharacterBody3D
# Ходьба от первого лица. WASD/стрелки — идти, Shift — бегом, пробел — прыжок,
# мышь — смотреть, клик — захватить мышь, Esc — отпустить.

const ШАГ := 2.6
const БЕГ := 5.0
const ПРЫЖОК := 3.6
var камера: Camera3D
var подсказка: Label
var g: float = ProjectSettings.get_setting("physics/3d/default_gravity")

func _ready() -> void:
	var форма := CollisionShape3D.new()
	var капсула := CapsuleShape3D.new()
	капсула.radius = 0.3
	капсула.height = 1.75
	форма.shape = капсула
	форма.position.y = 0.875
	add_child(форма)
	камера = Camera3D.new()
	камера.position.y = 1.62
	камера.fov = 72
	камера.current = true
	add_child(камера)
	var слой := CanvasLayer.new()
	add_child(слой)
	подсказка = Label.new()
	подсказка.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	подсказка.position = Vector2(-400, -110)
	подсказка.size = Vector2(800, 80)
	подсказка.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	подсказка.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	подсказка.add_theme_font_size_override("font_size", 20)
	подсказка.add_theme_color_override("font_shadow_color", Color.BLACK)
	подсказка.add_theme_constant_override("shadow_offset_x", 2)
	подсказка.add_theme_constant_override("shadow_offset_y", 2)
	подсказка.text = "Клик — управлять мышью. WASD — идти, Shift — бегом, Esc — отпустить мышь."
	слой.add_child(подсказка)
	var прицел := Label.new()
	прицел.text = "·"
	прицел.set_anchors_preset(Control.PRESET_CENTER)
	прицел.add_theme_font_size_override("font_size", 28)
	слой.add_child(прицел)

func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and e.physical_keycode == KEY_ESCAPE:
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-e.relative.x * 0.0025)
		камера.rotation.x = clamp(камера.rotation.x - e.relative.y * 0.0025, -1.45, 1.45)

func _клавиша(a: Key, b: Key) -> float:
	return 1.0 if Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b) else 0.0

func _physics_process(dt: float) -> void:
	var вход := Vector2(_клавиша(KEY_D, KEY_RIGHT) - _клавиша(KEY_A, KEY_LEFT),
		_клавиша(KEY_S, KEY_DOWN) - _клавиша(KEY_W, KEY_UP))
	var куда := (transform.basis * Vector3(вход.x, 0, вход.y)).normalized()
	var скорость := БЕГ if Input.is_physical_key_pressed(KEY_SHIFT) else ШАГ
	velocity.x = move_toward(velocity.x, куда.x * скорость, 20 * dt)
	velocity.z = move_toward(velocity.z, куда.z * скорость, 20 * dt)
	if is_on_floor():
		if Input.is_physical_key_pressed(KEY_SPACE): velocity.y = ПРЫЖОК
	else:
		velocity.y -= g * dt
	move_and_slide()
	_смотрю()

func _смотрю() -> void:
	# На что смотрю в пределах трёх метров — подпись из канона.
	var от := камера.global_position
	var q := PhysicsRayQueryParameters3D.create(от, от - камера.global_basis.z * 3.0)
	q.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit and hit.collider.has_meta("label"):
		подсказка.text = hit.collider.get_meta("label")
	elif Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		подсказка.text = ""
