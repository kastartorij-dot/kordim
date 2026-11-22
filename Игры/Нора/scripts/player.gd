extends CharacterBody3D
# Ходьба от первого лица. WASD/стрелки — идти, Shift — бегом, пробел — прыжок,
# мышь — смотреть, клик — захватить мышь, Esc — меню паузы.

const ШАГ := 2.6
const БЕГ := 5.0
const ПРЫЖОК := 3.6
var камера: Camera3D
var подсказка: Label
var плашка: PanelContainer
var прицел: Label
var цель: CollisionObject3D
var на_лестнице := false
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
	плашка = PanelContainer.new()
	плашка.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var оформление := StyleBoxFlat.new()
	оформление.bg_color = Color(.065,.055,.046,.81)
	оформление.border_color = Color(.44,.32,.22,.56)
	оформление.set_border_width_all(1)
	оформление.set_corner_radius_all(5)
	оформление.content_margin_left = 15
	оформление.content_margin_right = 15
	оформление.content_margin_top = 8
	оформление.content_margin_bottom = 8
	плашка.add_theme_stylebox_override("panel",оформление)
	слой.add_child(плашка)
	подсказка = Label.new()
	подсказка.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	подсказка.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	подсказка.add_theme_font_size_override("font_size", 16)
	подсказка.add_theme_color_override("font_color",Color(.94,.86,.72))
	плашка.add_child(подсказка)
	прицел = Label.new()
	прицел.text = "·"
	прицел.add_theme_font_size_override("font_size", 22)
	прицел.add_theme_color_override("font_color",Color(.96,.87,.72,.68))
	прицел.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	прицел.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	прицел.mouse_filter = Control.MOUSE_FILTER_IGNORE
	слой.add_child(прицел)
	прицел.set_anchors_preset(Control.PRESET_CENTER)
	прицел.offset_left = -10
	прицел.offset_right = 10
	прицел.offset_top = -14
	прицел.offset_bottom = 14
	get_viewport().size_changed.connect(_разместить_подсказку)
	_разместить_подсказку()

func _разместить_подсказку() -> void:
	var размер := get_viewport().get_visible_rect().size
	var ширина := minf(размер.x - 24.0, 460.0)
	плашка.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	плашка.offset_left = -ширина * 0.5
	плашка.offset_right = ширина * 0.5
	плашка.offset_top = -72
	плашка.offset_bottom = -26


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	elif e is InputEventKey and e.pressed and not e.echo and e.physical_keycode == KEY_E:
		if not на_лестнице and is_instance_valid(цель) and цель.has_meta("interact_kind"):
			get_tree().current_scene.interact(цель.get_meta("interact_kind"), self)
	elif e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		rotate_y(-e.relative.x * 0.0025)
		камера.rotation.x = clamp(камера.rotation.x - e.relative.y * 0.0025, -1.45, 1.45)

func _клавиша(a: Key, b: Key) -> float:
	return 1.0 if Input.is_physical_key_pressed(a) or Input.is_physical_key_pressed(b) else 0.0

func _physics_process(dt: float) -> void:
	if на_лестнице:
		_смотрю()
		return
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
	q.collision_mask = 3
	q.collide_with_areas = true
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	цель = hit.get("collider") as CollisionObject3D
	var захват := Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	прицел.visible = захват
	if not захват:
		подсказка.text = "Клик · взгляд     WASD · ходьба     E · действие     Esc · меню"
	elif на_лестнице:
		подсказка.text = ""
	elif is_instance_valid(цель) and цель.has_meta("label"):
		подсказка.text = цель.get_meta("label")
	else:
		подсказка.text = ""
	плашка.visible = not подсказка.text.is_empty()
