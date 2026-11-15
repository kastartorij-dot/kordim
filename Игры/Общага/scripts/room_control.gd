extends Area3D
var kind := "light"
var scene: Node3D
var closed := false
var cloth: Node3D
var original_scale := Vector3.ONE
var original_position := Vector3.ZERO
var rest_target := Vector3.ZERO
var animation: Tween
func prompt() -> String:
	if kind == "chair": return "E — сесть на стул"
	if kind == "bed": return "E — лечь на кровать"
	if kind == "curtain": return "E — %s штору" % ("раздвинуть" if closed else "задвинуть")
	return "E — %s" % ("переключить ночник" if kind == "lamp" else "переключить свет")
func toggle() -> void:
	if kind in ["chair", "bed"]:
		if not scene.player.can_stand_at(scene.player.global_transform):
			scene._show_status("Сначала выйдите на свободное место рядом с мебелью")
			return
		scene.player.start_rest(kind, global_position - Vector3(0, 0.45, 0), rest_target)
		return
	if kind == "curtain": set_closed(not closed)
	elif kind == "lamp": scene._set_lighting(0 if scene.lighting_mode == 2 else 2)
	else: scene._set_lighting((scene.lighting_mode + 1) % 3)
func set_closed(value: bool, immediate := false) -> void:
	closed = value
	var shape := get_child(0) as CollisionShape3D
	var box := shape.shape as BoxShape3D
	box.size.z = 1.62 if closed else 0.20
	position.z = (-0.81 if original_position.z > -1.6 else -2.39) if closed else (-0.08 if original_position.z > -1.6 else -3.12)
	if cloth == null: return
	if animation: animation.kill()
	var target := original_scale
	target.z *= 2.25 if closed else 0.22
	if immediate: cloth.scale = target
	else:
		animation = create_tween()
		animation.tween_property(cloth, "scale", target, 0.65).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
