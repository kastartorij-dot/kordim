extends Node3D

const ДАННЫЕ := preload("res://scripts/layout.gd").DATA
const ЛЮК: Array = ДАННЫЕ.room.hatch

@onready var огонь: OmniLight3D = $"Сруб/Очаг/Огонь"
@onready var люк: Node3D = $"Сруб/Люк"
@onready var петля: Node3D = $"Сруб/Люк/Петля"
@onready var проём: Area3D = $"Сруб/Люк/Спуск"
@onready var свет_люка: SpotLight3D = $"Сруб/Люк/Свет_сверху"
var открыт := false
var переход_лестницы: Tween
var движение_люка: Tween

var terrain: Node3D

func _ready() -> void:
	get_viewport().screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	terrain = preload("res://scripts/terrain.gd").new()
	terrain.name = "Участок"
	add_child(terrain)
	terrain.build()
	preload("res://scripts/forest.gd").new().populate(terrain, terrain.height_at)
	var detail := preload("res://scripts/site_details.gd").new()
	detail.name = "Камни_и_валежник"
	terrain.add_child(detail)
	detail.populate(terrain)
	var игрок := CharacterBody3D.new()
	игрок.name = "Игрок"
	игрок.set_script(load("res://scripts/player.gd"))
	add_child(игрок)
	if "--inside" in OS.get_cmdline_user_args():
		игрок.position = Vector3(2.15, .07, 2.62)
		игрок.rotation.y = deg_to_rad(39)
		игрок.камера.rotation.x = deg_to_rad(-10)
	else:
		игрок.position = Vector3(6.45, terrain.height_at(6.45, 7.80)+.055, 7.80)
		игрок.rotation.y = deg_to_rad(50)
	var меню := preload("res://scripts/pause_menu.gd").new()
	меню.name = "Меню_паузы"
	add_child(меню)
	if DisplayServer.get_name() != "headless":
		var звуки := preload("res://scripts/ambience.gd").new()
		звуки.name = "Звуки_Норы"
		add_child(звуки)
		звуки.setup(игрок, огонь.global_position)

func _process(_delta: float) -> void:
	var t := Time.get_ticks_msec() * .001
	огонь.light_energy = 2.28 + .12 * sin(t * 5.1) + .07 * sin(t * 9.4)

func interact(действие: String, игрок: CharacterBody3D) -> void:
	if переход_лестницы != null and переход_лестницы.is_running():
		return
	match действие:
		"hatch":
			var от_центра := игрок.global_position - люк.global_position
			var над_проёмом := absf(от_центра.x) < ЛЮК[2] / 2 + .17 and absf(от_центра.z) < ЛЮК[3] / 2 + .17
			if открыт and над_проёмом and от_центра.y > -.60:
				return
			_двинуть_люк(not открыт)
		"ladder":
			_пройти_лестницу(игрок)

func _двинуть_люк(открыть: bool) -> void:
	открыт = открыть
	проём.collision_layer = 2 if открыть else 0
	свет_люка.visible = открыть
	if движение_люка != null:
		движение_люка.kill()
	движение_люка = _переход()
	var угол := deg_to_rad(103) if открыть else 0.0
	движение_люка.tween_property(петля,"rotation:z",угол,.43).set_trans(Tween.TRANS_SINE)

func _пройти_лестницу(игрок: CharacterBody3D) -> void:
	var at := люк.global_position
	var from := игрок.global_position
	var вверх := from.y < at.y-1.0
	var upper := at+Vector3(.83,.062,0)
	var lower := at+Vector3(.76,-2.04,0)
	var entry := lower if вверх else upper
	if Vector2(from.x,from.z).distance_to(Vector2(entry.x,entry.z)) > .91:
		return
	var slide := Vector3(entry.x-from.x,0,entry.z-from.z)
	var approach := Transform3D(игрок.global_basis,Vector3(from.x,entry.y+.025,from.z))
	if slide.length_squared() > .0049 and игрок.test_move(approach,slide):
		return
	if not открыт:
		_двинуть_люк(true)
	var exit := upper if вверх else lower
	var shaft_x := at.x+.09
	var top_rung := Vector3(shaft_x,upper.y,at.z)
	var bottom_rung := Vector3(shaft_x,lower.y,at.z)
	var first := bottom_rung if вверх else top_rung
	var last := top_rung if вверх else bottom_rung
	игрок.velocity = Vector3.ZERO
	игрок.set("на_лестнице",true)
	переход_лестницы = _переход()
	if движение_люка != null and движение_люка.is_running():
		переход_лестницы.tween_interval(maxf(.0,.44-движение_люка.get_total_elapsed_time()))
	переход_лестницы.tween_property(игрок,"global_position",entry,.19).set_trans(Tween.TRANS_SINE)
	переход_лестницы.tween_property(игрок,"global_position",first,.29).set_trans(Tween.TRANS_SINE)
	переход_лестницы.tween_method(_шаг_лестницы.bind(игрок,first,last),0.0,1.0,1.39)
	переход_лестницы.tween_property(игрок,"global_position",exit,.34).set_trans(Tween.TRANS_SINE)
	переход_лестницы.tween_callback(func() -> void: игрок.set("на_лестнице",false))

func _шаг_лестницы(t: float, игрок: CharacterBody3D, from: Vector3, to: Vector3) -> void:
	var at := from.lerp(to,t)
	at.y += sin(t*TAU*7.0)*.012
	at.z += sin(t*TAU*3.5)*.027
	игрок.global_position = at

func _переход() -> Tween:
	return create_tween().set_process_mode(Tween.TWEEN_PROCESS_PHYSICS).set_ease(Tween.EASE_IN_OUT)
