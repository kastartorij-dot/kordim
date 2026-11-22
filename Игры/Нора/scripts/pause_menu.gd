extends CanvasLayer

const SETTINGS_PATH := "user://settings.cfg"
const TEXT := Color(.94,.87,.75)
const ACCENT := Color(.72,.52,.29)

var master_bus := AudioServer.get_bus_index("Master")
var settings := ConfigFile.new()
var overlay: ColorRect
var slider: HSlider
var percent: Label
var previous_mouse_mode := Input.MOUSE_MODE_VISIBLE
var changed := false

func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	settings.load(SETTINGS_PATH)
	_build_menu()
	slider.set_value_no_signal(clampf(float(settings.get_value("audio","master",100)),0,100))
	_apply_volume(slider.value)
	overlay.hide()

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_ESCAPE:
		get_viewport().set_input_as_handled()
		if overlay.visible:
			_resume()
		else:
			previous_mouse_mode = Input.mouse_mode
			get_tree().paused = true
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			overlay.show()
			slider.grab_focus()

func _resume() -> void:
	_save_settings()
	overlay.hide()
	Input.mouse_mode = previous_mouse_mode
	get_tree().paused = false

func _apply_volume(value: float) -> void:
	AudioServer.set_bus_volume_db(master_bus,linear_to_db(maxf(value / 100.0,.0001)))
	AudioServer.set_bus_mute(master_bus,is_zero_approx(value))
	percent.text = "%d%%" % roundi(value)

func _volume_changed(value: float) -> void:
	_apply_volume(value)
	settings.set_value("audio","master",roundi(value))
	changed = true

func _save_settings() -> void:
	if changed and settings.save(SETTINGS_PATH) == OK:
		changed = false

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST:
		_save_settings()

func _panel_style(fill: Color, border: Color, radius: int, width: int = 1) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(width)
	style.set_corner_radius_all(radius)
	return style

func _label(value: String, size: int, color: Color) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size",size)
	label.add_theme_color_override("font_color",color)
	return label

func _build_menu() -> void:
	overlay = ColorRect.new()
	overlay.color = Color(.045,.037,.031,.70)
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(overlay)
	var center := CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(center)
	var card := PanelContainer.new()
	var frame := _panel_style(Color(.127,.101,.079),Color(.44,.34,.23),6)
	frame.set_content_margin_all(24)
	card.add_theme_stylebox_override("panel",frame)
	center.add_child(card)
	var content := VBoxContainer.new()
	content.custom_minimum_size.x = 276
	content.add_theme_constant_override("separation",15)
	card.add_child(content)
	content.add_child(_label("Пауза",27,TEXT))
	var captions := HBoxContainer.new()
	var audio_title := _label("Громкость",17,TEXT)
	audio_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	captions.add_child(audio_title)
	percent = _label("",17,ACCENT.lightened(.32))
	captions.add_child(percent)
	content.add_child(captions)
	slider = HSlider.new()
	slider.max_value = 100
	slider.step = 1
	slider.tooltip_text = "Общая громкость"
	slider.custom_minimum_size.y = 26
	for state in ["slider","grabber_area","grabber_area_highlight"]:
		var fill := Color(.26,.21,.16) if state == "slider" else ACCENT
		var bar := _panel_style(fill,Color.TRANSPARENT,3,0)
		bar.content_margin_top = 3
		bar.content_margin_bottom = 3
		slider.add_theme_stylebox_override(state,bar)
	slider.value_changed.connect(_volume_changed)
	slider.drag_ended.connect(func(_value_changed: bool) -> void: _save_settings())
	content.add_child(slider)
	var resume := Button.new()
	resume.text = "Продолжить"
	resume.custom_minimum_size.y = 40
	resume.add_theme_color_override("font_color",TEXT)
	resume.add_theme_stylebox_override("normal",_panel_style(Color(.22,.168,.115),Color(.46,.34,.23),4))
	resume.add_theme_stylebox_override("hover",_panel_style(Color(.31,.234,.15),ACCENT,4))
	resume.add_theme_stylebox_override("pressed",_panel_style(Color(.18,.133,.093),ACCENT,4))
	resume.pressed.connect(_resume)
	content.add_child(resume)
