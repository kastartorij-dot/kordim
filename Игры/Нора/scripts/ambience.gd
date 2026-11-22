extends Node3D

const WIND: AudioStreamWAV = preload("res://audio/wind.res")
const CREEK: AudioStreamWAV = preload("res://audio/creek.res")
const FIRE: AudioStreamWAV = preload("res://audio/hearth.res")
const WOOD_STEP: AudioStreamWAV = preload("res://audio/step_wood.res")
const EARTH_STEP: AudioStreamWAV = preload("res://audio/step_earth.res")

var listener: CharacterBody3D
var wind_player: AudioStreamPlayer
var creek_player: AudioStreamPlayer3D
var hearth_player: AudioStreamPlayer3D
var foot_player: AudioStreamPlayer
var last_position: Vector3
var step_distance := 0.0
var indoor := 0.0
var step_index := 0

func setup(player: CharacterBody3D, hearth_position: Vector3) -> void:
	listener = player
	last_position = listener.global_position
	wind_player = AudioStreamPlayer.new()
	wind_player.name = "Ветер"
	wind_player.process_mode = Node.PROCESS_MODE_ALWAYS
	wind_player.stream = WIND
	wind_player.volume_db = -21.0
	add_child(wind_player)
	wind_player.play()
	creek_player = _sound("Ручей", CREEK, Vector3(-1.8,-2.65,-17.0), -19.0, 15.0)
	hearth_player = _sound("Огонь", FIRE, hearth_position, -11.5, 8.8)
	foot_player = AudioStreamPlayer.new()
	foot_player.name = "Шаги"
	foot_player.volume_db = -16.5
	add_child(foot_player)

func _sound(title: String, data: AudioStream, at: Vector3, volume: float, reach: float) -> AudioStreamPlayer3D:
	var audio := AudioStreamPlayer3D.new()
	audio.name = title
	audio.process_mode = Node.PROCESS_MODE_ALWAYS
	audio.stream = data
	audio.volume_db = volume
	audio.max_distance = reach
	audio.unit_size = 1.29
	add_child(audio)
	audio.global_position = at
	audio.play()
	return audio

func _process(delta: float) -> void:
	if listener == null:
		return
	var at := listener.global_position
	var in_room := absf(at.x) < 4.47 and absf(at.z) < 3.48
	var target := 1.0 if in_room else 0.0
	indoor = move_toward(indoor, target, delta*2.4)
	wind_player.volume_db = lerpf(-21.0, -37.0, indoor)
	creek_player.volume_db = lerpf(-19.0, -29.0, indoor)
	hearth_player.volume_db = lerpf(-24.0, -11.5, indoor)
	var travelled := Vector2(at.x-last_position.x, at.z-last_position.z).length()
	last_position = at
	if travelled > .48:
		step_distance = 0.0
		return
	if not listener.is_on_floor() or travelled < .004:
		return
	step_distance += travelled
	var stride := .74 if listener.velocity.length() < 3.5 else .94
	if step_distance < stride:
		return
	step_distance = fmod(step_distance,stride)
	var floorboards := in_room and at.y > -.55
	var stream := WOOD_STEP if floorboards else EARTH_STEP
	if foot_player.stream != stream:
		foot_player.stream = stream
	step_index += 1
	foot_player.pitch_scale = .88+.22*(.5+.5*sin(step_index*7.49))
	foot_player.volume_db = -16.6 if floorboards else -18.5
	foot_player.play()

func _exit_tree() -> void:
	for audio in [wind_player, creek_player, hearth_player, foot_player]:
		if is_instance_valid(audio):
			audio.stop()
			audio.stream = null
