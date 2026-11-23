extends "res://vendor/cogito/cogito_door.gd"
## Адаптер COGITO: наши петли/направления GLB и остановка перед капсулой игрока.

var spec: Dictionary
var base_transform: Transform3D
var value := 0.0
var opened: bool:
	get: return is_open
var moving: bool:
	get: return is_moving
var blocked := false
var collision: CollisionShape3D

func configure(mesh_node: MeshInstance3D, settings: Dictionary) -> void:
	spec = settings
	var body := self as AnimatableBody3D
	body.collision_layer = 2
	body.collision_mask = 4
	body.sync_to_physics = false
	global_transform = mesh_node.global_transform
	mesh_node.reparent(self, true)
	collision = CollisionShape3D.new()
	collision.shape = mesh_node.mesh.create_convex_shape(true, false)
	add_child(collision)
	is_open = spec.get("initial_open", false)
	value = spec.get("initial_value", spec.opened if is_open else spec.closed)
	base_transform = transform * _offset(value).affine_inverse()
	var closed_pose := base_transform * _offset(spec.closed)
	var open_pose := base_transform * _offset(spec.opened)
	closed_rotation = closed_pose.basis.get_euler() * (180.0 / PI)
	open_rotation = open_pose.basis.get_euler() * (180.0 / PI)
	closed_position = closed_pose.origin
	open_position = open_pose.origin
	door_type = DoorType.ROTATING if spec.kind == "rotate" else DoorType.SLIDING
	door_speed = deg_to_rad(100) if spec.kind == "rotate" else 0.45
	angle_tolerance = 0.01
	display_name = spec.label
	interaction_text_when_open = "закрыть"
	interaction_text_when_closed = "открыть"

func _offset(at: float) -> Transform3D:
	var axis := Vector3(spec.axis[0], spec.axis[1], spec.axis[2])
	if spec.kind == "rotate":
		return Transform3D(Basis(axis, at), Vector3.ZERO)
	return Transform3D(Basis.IDENTITY, axis * at)

func toggle() -> void:
	blocked = false
	interact(self)

func prompt() -> String:
	if blocked: return "Проход занят · отойдите и нажмите E"
	return "E — %s · %s" % ["закрыть" if is_open else "открыть", spec.label]

func _physics_process(delta: float) -> void:
	if not is_moving or spec.is_empty(): return
	var previous := transform
	super(delta)
	var candidate := transform
	transform = previous
	# Проверяем весь ход, в том числе при медленном кадре.
	var angle := previous.basis.get_rotation_quaternion().angle_to(candidate.basis.get_rotation_quaternion())
	var count := maxi(1, ceili(maxf(angle / deg_to_rad(1), previous.origin.distance_to(candidate.origin) / 0.01)))
	for i in range(1, count + 1):
		var pose := previous.interpolate_with(candidate, float(i) / count)
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = collision.shape
		query.transform = get_parent().global_transform * pose
		query.collision_mask = 4
		query.margin = 0.015
		if not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
			blocked = true
			is_moving = false
			break
		transform = pose
	_update_value()

func _update_value() -> void:
	var relative := base_transform.affine_inverse() * transform
	var axis := Vector3(spec.axis[0], spec.axis[1], spec.axis[2])
	value = relative.basis.get_euler().dot(axis) if spec.kind == "rotate" else relative.origin.dot(axis)

func restore_state(state: Dictionary, legacy_furniture: bool = false) -> void:
	is_moving = false
	blocked = false
	is_open = state.is_open
	is_locked = state.is_locked
	if legacy_furniture:
		transform = base_transform * _offset(spec.opened if is_open else spec.closed)
		_update_value()
		return
	position = Vector3(state.pos_x, state.pos_y, state.pos_z)
	rotation = Vector3(state.rot_x, state.rot_y, state.rot_z)
	_update_value()
	if spec.get("clamp_saved_pose", false):
		var limited := clampf(value, minf(spec.closed, spec.opened), maxf(spec.closed, spec.opened))
		if not is_equal_approx(value, limited):
			transform = base_transform * _offset(limited)
			_update_value()
