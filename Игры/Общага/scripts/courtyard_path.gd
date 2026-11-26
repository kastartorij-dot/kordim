extends MeshInstance3D
## Маршрут с авторской схемы. Координата Y схемы в Godot становится -Z.

func _ready() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	_add_lane(surface, [Vector2(6.4, -22.1), Vector2(11.1, -22.0), Vector2(16.4, -22.2), Vector2(21.0, -23.1)])
	_add_lane(surface, [Vector2(9.5, -22.0), Vector2(14.9, -16.0), Vector2(16.6, -10.0), Vector2(17.6, -2.0), Vector2(18.0, 10.0), Vector2(19.4, 20.4), Vector2(22.1, 24.0)])
	_add_lane(surface, [Vector2(6.4, 25.2), Vector2(14.0, 24.8), Vector2(24.0, 25.0), Vector2(36.0, 25.25), Vector2(48.2, 25.0)])
	surface.generate_normals()
	mesh = surface.commit()
	var track := ShaderMaterial.new()
	track.shader = preload("res://textures/courtyard_path.gdshader")
	material_override = track
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func set_winter(winter: bool) -> void:
	material_override.set_shader_parameter("winter", winter)

func _add_lane(surface: SurfaceTool, points: Array[Vector2]) -> void:
	var curve := Curve2D.new()
	curve.bake_interval = 0.35
	for i in range(points.size()):
		var tangent := Vector2.ZERO
		if i > 0 and i < points.size() - 1:
			tangent = (points[i + 1] - points[i - 1]).normalized()
			tangent *= minf(points[i].distance_to(points[i - 1]), points[i].distance_to(points[i + 1])) * 0.27
		curve.add_point(points[i], -tangent, tangent)
	var samples := curve.get_baked_points()
	var left := PackedVector3Array()
	var right := PackedVector3Array()
	for i in range(samples.size()):
		var direction := samples[mini(i + 1, samples.size() - 1)] - samples[maxi(i - 1, 0)]
		var side := direction.normalized().orthogonal() * 0.93
		var a := samples[i] - side
		var b := samples[i] + side
		left.append(Vector3(a.x, -4.939, a.y))
		right.append(Vector3(b.x, -4.939, b.y))
	for i in range(samples.size() - 1):
		_add_vertex(surface, left[i], 0.0)
		_add_vertex(surface, right[i], 1.0)
		_add_vertex(surface, left[i + 1], 0.0)
		_add_vertex(surface, right[i], 1.0)
		_add_vertex(surface, right[i + 1], 1.0)
		_add_vertex(surface, left[i + 1], 0.0)

func _add_vertex(surface: SurfaceTool, point: Vector3, across: float) -> void:
	surface.set_uv(Vector2(across, 0))
	surface.add_vertex(point)
