extends Node
# Скриншот для проверки без окна. Запуск: godot --path . -- --shot=shots/имя.png [--frames=60]
# Без аргумента --shot ничего не делает, игре не мешает.

var _path := ""
var _frames := 60

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--shot="): _path = a.substr(7)
		elif a.begins_with("--frames="): _frames = int(a.substr(9))
	set_process(_path != "")

func _process(_d: float) -> void:
	_frames -= 1
	if _frames > 0: return
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://" + _path.get_base_dir()))
	get_viewport().get_texture().get_image().save_png("res://" + _path)
	print("снимок: ", _path)
	get_tree().quit()
