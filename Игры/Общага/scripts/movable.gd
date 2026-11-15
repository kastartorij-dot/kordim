extends AnimatableBody3D
## Геометрия и коллизия движутся вместе. Малые шаги не дают створке пройти через игрока.

var spec: Dictionary
var base_transform: Transform3D
var value := 0.0
var opened := false
var moving := false
var blocked := false
var collision: CollisionShape3D

func configure(mesh_node: MeshInstance3D, settings: Dictionary) -> void:
	spec = settings
	collision_layer = 2
	collision_mask = 4
	sync_to_physics = false
	global_transform = mesh_node.global_transform
	base_transform = transform
	mesh_node.reparent(self, true)
	collision = CollisionShape3D.new()
	collision.shape = mesh_node.mesh.create_convex_shape(true, false)
	add_child(collision)
	opened = spec.get("initial_open", false)
	value = spec.get("initial_value", spec.opened if opened else spec.closed)
	# Экспорт хранит исходную позу. initial_value описывает её, не двигая меш второй раз.
	base_transform = transform * _offset(value).affine_inverse()

func _offset(at: float) -> Transform3D:
	var axis := Vector3(spec.axis[0], spec.axis[1], spec.axis[2])
	if spec.kind == "rotate":
		return Transform3D(Basis(axis, at), Vector3.ZERO)
	return Transform3D(Basis.IDENTITY, axis * at)

func toggle() -> void:
	opened = not opened
	moving = true
	blocked = false

func prompt() -> String:
	if blocked: return "Проход занят · отойдите и нажмите E"
	return "E — %s · %s" % ["закрыть" if opened else "открыть", spec.label]

func _physics_process(delta: float) -> void:
	if not moving: return
	var target: float = spec.opened if opened else spec.closed
	var speed := deg_to_rad(100) if spec.kind == "rotate" else 0.45
	var next := move_toward(value, target, speed * delta)
	var step := deg_to_rad(1) if spec.kind == "rotate" else 0.01
	var count := maxi(1, ceili(absf(next - value) / step))
	var start := value
	for i in range(1, count + 1):
		var candidate := lerpf(start, next, float(i) / count)
		var pose := base_transform * _offset(candidate)
		var query := PhysicsShapeQueryParameters3D.new()
		query.shape = collision.shape
		query.transform = get_parent().global_transform * pose
		query.collision_mask = 4
		query.margin = 0.015
		if not get_world_3d().direct_space_state.intersect_shape(query, 1).is_empty():
			blocked = true
			moving = false
			return
		transform = pose
		value = candidate
	if is_equal_approx(value, target): moving = false
