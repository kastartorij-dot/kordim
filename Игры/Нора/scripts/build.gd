extends Node3D

const ДАННЫЕ := preload("res://scripts/layout.gd").DATA
const ЛЮК: Array = ДАННЫЕ.room.hatch

@onready var огонь: OmniLight3D = $"Сруб/Очаг/Огонь"
@onready var люк: Node3D = $"Сруб/Люк"
@onready var петля: Node3D = $"Сруб/Люк/Петля"
var открыт := false
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
	if DisplayServer.get_name() != "headless":
		var звуки := preload("res://scripts/ambience.gd").new()
		звуки.name = "Звуки_Норы"
		add_child(звуки)
		звуки.setup(игрок, огонь.global_position)

func _process(_delta: float) -> void:
	var t := Time.get_ticks_msec() * .001
	огонь.light_energy = 2.28 + .12 * sin(t * 5.1) + .07 * sin(t * 9.4)

func interact(действие: String, игрок: CharacterBody3D) -> void:
	match действие:
		"hatch":
			var от_центра := игрок.global_position - люк.global_position
			var над_проёмом := absf(от_центра.x) < ЛЮК[2] / 2 and absf(от_центра.z) < ЛЮК[3] / 2
			if открыт and над_проёмом and от_центра.y > -.60:
				return
			_двинуть_люк(not открыт)
		"ladder":
			if not открыт:
				_двинуть_люк(true)
			var наверх := игрок.global_position.y < -1.0
			var точка := люк.global_position + (Vector3(.92,.06,.14) if наверх else Vector3(.65,-2.055,0))
			игрок.global_position = точка
			игрок.velocity = Vector3.ZERO
			игрок.reset_physics_interpolation()

func _двинуть_люк(открыть: bool) -> void:
	открыт = открыть
	if движение_люка != null:
		движение_люка.kill()
	движение_люка = create_tween()
	var animation := движение_люка.tween_property(петля, "rotation:z", deg_to_rad(103) if открыт else 0.0, .43)
	animation.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
