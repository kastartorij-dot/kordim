extends Control

var room: Node3D
var winter: Node3D
var brightness: VSlider
var percent: Label
var power: Button
var mode_buttons: Array[Button] = []

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
	title.text = "Гирлянды"
	title.add_theme_font_size_override("font_size", 23)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var close := Button.new()
	close.text = "x"
	close.tooltip_text = "Закрыть (Esc)"
	close.custom_minimum_size.x = 36
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(_close)
	header.add_child(close)

	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 22)
	column.add_child(body)

	var modes_box := VBoxContainer.new()
	modes_box.add_theme_constant_override("separation", 8)
	body.add_child(modes_box)
	var mode_label := Label.new()
	mode_label.text = "Режим свечения"
	modes_box.add_child(mode_label)
	var grid := GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 8)
	grid.add_theme_constant_override("v_separation", 8)
	modes_box.add_child(grid)

	var group := ButtonGroup.new()
	for index in winter.GARLAND_MODES.size():
		var spec: Dictionary = winter.GARLAND_MODES[index]
		var btn := Button.new()
		btn.text = spec.name
		btn.tooltip_text = spec.desc
		btn.custom_minimum_size = Vector2(156, 40)
		btn.toggle_mode = true
		btn.button_group = group
		btn.focus_mode = Control.FOCUS_NONE
		var accent: Color = spec.accent
		btn.add_theme_stylebox_override("normal", _style(Color("#202836"), Color("#384354"), 10))
		var hover := _style(accent.darkened(0.45), accent.lightened(0.25), 10)
		hover.shadow_color = Color(accent, 0.45)
		hover.shadow_size = 4
		btn.add_theme_stylebox_override("hover", hover)
		btn.add_theme_stylebox_override("hover_pressed", hover)
		btn.add_theme_stylebox_override("pressed", _style(accent.darkened(0.32), accent.lightened(0.35), 10))
		btn.pressed.connect(_choose_mode.bind(index))
		grid.add_child(btn)
		mode_buttons.append(btn)

	var level := VBoxContainer.new()
	level.add_theme_constant_override("separation", 6)
	body.add_child(level)
	var brightness_label := Label.new()
	brightness_label.text = "Яркость"
	brightness_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level.add_child(brightness_label)
	percent = Label.new()
	percent.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	level.add_child(percent)
	brightness = VSlider.new()
	brightness.tooltip_text = "Яркость гирлянд"
	brightness.min_value = 10
	brightness.max_value = 100
	brightness.step = 1
	brightness.custom_minimum_size.y = 106
	brightness.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	brightness.value_changed.connect(_set_brightness)
	level.add_child(brightness)

	power = Button.new()
	power.custom_minimum_size.x = 112
	power.focus_mode = Control.FOCUS_NONE
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
	if winter == null: return
	brightness.set_value_no_signal(winter.garland_brightness * 100.0)
	percent.text = "%d%%" % int(round(brightness.value))
	if winter.garland_mode >= 0 and winter.garland_mode < mode_buttons.size():
		mode_buttons[winter.garland_mode].set_pressed_no_signal(true)
	_refresh_power()
	show()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _close() -> void:
	hide()
	if room != null and room.player != null:
		room.player.ignore_capture_motion = true
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _input(event: InputEvent) -> void:
	if visible and event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE:
		_close()
		get_viewport().set_input_as_handled()

func _choose_mode(index: int) -> void:
	if winter == null: return
	winter.set_garland_mode(index)
	if not winter.garland_on:
		winter.set_garland_on(true)
		_refresh_power()

func _set_brightness(value: float) -> void:
	percent.text = "%d%%" % int(round(value))
	if winter != null:
		winter.set_garland_brightness(value / 100.0)

func _toggle_power() -> void:
	if winter == null: return
	winter.set_garland_on(not winter.garland_on)
	_refresh_power()

func _refresh_power() -> void:
	power.text = "Выключить" if (winter != null and winter.garland_on) else "Включить"
