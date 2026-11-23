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
	if kind == "lamp": return "ЛКМ / E — настроить ночник"
	return "E — %s главный свет" % ("выключить" if scene.ceiling_light.visible else "включить")
func toggle() -> void:
	if kind in ["chair", "bed"]:
		if not scene.player.can_stand_at(scene.player.global_transform):
			scene._show_status("Сначала выйдите на свободное место рядом с мебелью")
			return
		scene.player.start_rest(kind, global_position - Vector3(0, 0.45, 0), rest_target)
		return
	if kind == "curtain": set_closed(not closed)
	elif kind == "lamp": scene.lamp_menu.open()
	else: scene._toggle_ceiling_light()
func set_closed(value: bool, immediate := false) -> void:
	closed = value
	var shape := get_child(0) as CollisionShape3D
	var box := shape.shape as BoxShape3D
	box.size.z = 1.60 if closed else 0.29
	position.z = (-0.81 if original_position.z > -1.6 else -2.39) if closed else (-0.14 if original_position.z > -1.6 else -3.06)
	if cloth == null: return
	if animation: animation.kill()
	var target := original_scale
	target.z *= 1.0 if closed else 0.18
	if immediate: cloth.scale = target
	else:
		animation = create_tween()
		animation.tween_property(cloth, "scale", target, 0.65).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
