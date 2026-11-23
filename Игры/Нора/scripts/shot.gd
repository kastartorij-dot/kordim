extends Node
# Скриншот для проверки без окна. Запуск:
#   godot --path . -- --shot=shots/имя.png [--frames=60] [--inside]
#       [--pos=x,z] [--yaw=градусы] [--pitch=градусы] [--hud=0]
# --inside  — старт в комнате (читает build.gd).
# --pos/--yaw/--pitch ставят игрока в точку участка (высота берётся с рельефа) и поворачивают
# камеру: кадры из одной и той же точки можно сравнивать до и после правок.
# Взгляд: yaw 0 — на -Z (от фасада), 90 — на -X, 180 — на +Z (к фасаду), -90 — на +X.
# --hud=0 прячет подсказку и прицел. Без --shot ничего не делает, игре не мешает.

var _path := ""
var _frames := 60
var _pos := Vector2.INF
var _yaw := INF
var _pitch := INF
var _hud := true
var _placed := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): _path = a.substr(7)
		elif a.begins_with("--frames="): _frames = int(a.substr(9))
		elif a.begins_with("--pos="):
			var xz := a.substr(6).split(",")
			if xz.size() == 2 and xz[0].is_valid_float() and xz[1].is_valid_float(): _pos = Vector2(float(xz[0]), float(xz[1]))
		elif a.begins_with("--yaw=") and a.substr(6).is_valid_float(): _yaw = float(a.substr(6))
		elif a.begins_with("--pitch=") and a.substr(8).is_valid_float(): _pitch = float(a.substr(8))
		elif a == "--hud=0": _hud = false
	set_process(_path != "")

func _configure_camera() -> bool:
	var scene := get_tree().current_scene
	if scene == null:
		return false
	var player := scene.get_node_or_null("Игрок") as CharacterBody3D
	if player == null:
		return false
	if _pos != Vector2.INF:
		var terrain := scene.get_node_or_null("Участок")
		var height := 0.1
		if terrain != null:
			height += float(terrain.height_at(_pos.x,_pos.y))
		player.global_position = Vector3(_pos.x,height,_pos.y)
		player.velocity = Vector3.ZERO
		player.reset_physics_interpolation()
		player.set_physics_process(false)
	if _yaw != INF:
		player.rotation.y = deg_to_rad(_yaw)
	if _pitch != INF:
		player.камера.rotation.x = clampf(deg_to_rad(_pitch),-1.45,1.45)
	if not _hud:
		for child in player.get_children():
			if child is CanvasLayer:
				child.hide()
	return true

func _process(_delta: float) -> void:
	if not _placed:
		_placed = _configure_camera()
		if not _placed:
			return
	_frames -= 1
	if _frames > 0:
		return
	var output := "res://" + _path
	var error := DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output.get_base_dir()))
	if error == OK:
		error = get_viewport().get_texture().get_image().save_png(output)
	if error != OK:
		push_error("Не удалось сохранить снимок %s: %s" % [_path,error_string(error)])
		get_tree().quit(1)
		return
	print("снимок: ", _path)
	get_tree().quit()
