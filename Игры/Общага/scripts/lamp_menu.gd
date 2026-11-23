extends Control

var room: Node3D
var brightness: VSlider
var percent: Label
var power: Button
var swatches: Array[Button] = []

func _ready() -> void:
	z_index = 10
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var overlay := ColorRect.new()
	overlay.color = Color(0.03, 0.04, 0.07, 0.26)
	add_child(overlay)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var center := CenterContainer.new()
	center.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(center)
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var card := PanelContainer.new()
	var panel := _style(Color("#171d28"), Color("#384354"), 16)
	panel.content_margin_left = 22
	panel.content_margin_right = 22
	panel.content_margin_top = 16
	panel.content_margin_bottom = 18
	card.add_theme_stylebox_override("panel", panel)
	center.add_child(card)
	var column := VBoxContainer.new()
	column.add_theme_constant_override("separation", 14)
	card.add_child(column)
	var header := HBoxContainer.new()
	column.add_child(header)
	var title := Label.new()
	title.text = "Ночник"
	title.add_theme_font_size_override("font_size", 23)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var close := Button.new()
	close.text = "×"
	close.tooltip_text = "Закрыть (Esc)"
	close.custom_minimum_size.x = 36
	close.pressed.connect(_close)
	header.add_child(close)
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 22)
	column.add_child(body)
	var palette := VBoxContainer.new()
	body.add_child(palette)
	var color_label := Label.new()
	color_label.text = "Цвет"
	palette.add_child(color_label)
	var grid := GridContainer.new()
	grid.columns = 3
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	palette.add_child(grid)
	var group := ButtonGroup.new()
	for index in room.LAMP_COLORS.size():
		var swatch := Button.new()
		var tint: Color = room.LAMP_COLORS[index]
		swatch.tooltip_text = room.LAMP_NAMES[index]
		swatch.custom_minimum_size = Vector2(48, 48)
		swatch.toggle_mode = true
		swatch.button_group = group
		swatch.add_theme_stylebox_override("normal", _style(tint.darkened(0.18), tint.darkened(0.3), 10))
		var hover := _style(tint.lightened(0.22), Color.WHITE, 10)
		hover.shadow_color = Color(tint, 0.75)
		hover.shadow_size = 6
		swatch.add_theme_stylebox_override("hover", hover)
		swatch.add_theme_stylebox_override("hover_pressed", hover)
		swatch.add_theme_stylebox_override("pressed", _style(tint, Color.WHITE, 10))
		swatch.mouse_entered.connect(_preview.bind(index))
		swatch.mouse_exited.connect(_preview.bind(-1))
		swatch.pressed.connect(_choose.bind(index))
		grid.add_child(swatch)
		swatches.append(swatch)
	var level := VBoxContainer.new()
	body.add_child(level)
	percent = Label.new()
	percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	var brightness_label := Label.new()
	brightness_label.text = "Яркость"
	brightness_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level.add_child(brightness_label)
	level.add_child(percent)
	brightness = VSlider.new()
	brightness.tooltip_text = "Яркость"
	brightness.min_value = 5
	brightness.max_value = 100
	brightness.step = 1
	brightness.custom_minimum_size.y = 106
	brightness.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	brightness.value_changed.connect(_set_brightness)
	level.add_child(brightness)
	power = Button.new()
	power.custom_minimum_size.x = 105
	power.pressed.connect(_toggle_power)
	level.add_child(power)
	hide()

func _style(fill: Color, border: Color, radius: int) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(radius)
	return style

func open() -> void:
	brightness.set_value_no_signal(room.lamp_brightness * 100)
	percent.text = "%d%%" % brightness.value
	swatches[room.lamp_color].set_pressed_no_signal(true)
	_refresh_power()
	show()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _close() -> void:
	hide()
	_preview(-1)
	room.player.ignore_capture_motion = true
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE:
		_close()
		get_viewport().set_input_as_handled()

func _preview(index: int) -> void:
	room.lamp_preview = index
	room._update_accent_lighting()

func _choose(index: int) -> void:
	room.lamp_color = index
	_preview(-1)

func _set_brightness(value: float) -> void:
	percent.text = "%d%%" % value
	room.lamp_brightness = value / 100.0
	room._update_accent_lighting()

func _toggle_power() -> void:
	room.lamp_on = not room.lamp_on
	_refresh_power()
	room._update_accent_lighting()

func _refresh_power() -> void:
	power.text = "Выключить" if room.lamp_on else "Включить"
