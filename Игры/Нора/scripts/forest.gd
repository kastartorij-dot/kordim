extends Node3D
## Лесная поляна «Норы». PS2-inspired: силуэты, многоплановый туман и немногословные детали.
## Деревья и подлесок инстансируются GPU, а не создаются сотнями MeshInstance3D.
## Все случайные позиции воспроизводимы (seed 1026).

const ТРОПА := [
	Vector2(1.4, 3.9), Vector2(0.7, 6.4), Vector2(-0.2, 9.0),
	Vector2(-1.5, 13.0), Vector2(-2.2, 17.0), Vector2(-2.45, 22.0)
]
const ДЕРЕВЬЕВ := 210
const РАДИУС_ЛЕСА := 53.0
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed = 1026
	_тропа()
	_деревья()
	_подлесок()
	_коновязь()
	_свет_из_двери()

func _материал(цвет: Color, шероховатость: float = 0.95) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.WHITE
	mat.vertex_color_use_as_albedo = true
	mat.roughness = шероховатость
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	return mat

func _множество(имя: String, меш: Mesh, положения: Array, цвета: Array) -> void:
	if положения.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = меш
	mm.instance_count = положения.size()
	for i in range(положения.size()):
		mm.set_instance_transform(i, положения[i])
		mm.set_instance_color(i, цвета[i])
	var инстансы := MultiMeshInstance3D.new()
	инстансы.name = имя
	инстансы.multimesh = mm
	add_child(инстансы)

func _дистанция_до_тропы(x: float, z: float) -> float:
	var p := Vector2(x, z)
	var наименьшая := INF
	for i in range(ТРОПА.size() - 1):
		var a: Vector2 = ТРОПА[i]
		var b: Vector2 = ТРОПА[i + 1]
		var d := b - a
		var t := clampf((p - a).dot(d) / d.length_squared(), 0.0, 1.0)
		наименьшая = minf(наименьшая, p.distance_to(a + d * t))
	return наименьшая

func _можно_сажать(x: float, z: float) -> bool:
	if absf(x) < 9.5 and absf(z) < 8.5:
		return false
	if absf(z + 17.0) < 2.3:
		return false
	if _дистанция_до_тропы(x, z) < 2.25:
		return false
	return true

func _деревья() -> void:
	var ствол := CylinderMesh.new()
	ствол.bottom_radius = 0.33
	ствол.top_radius = 0.16
	ствол.height = 1.0
	ствол.radial_segments = 7
	ствол.rings = 1
	ствол.material = _материал(Color(0.34, 0.27, 0.22))

	var крона := CylinderMesh.new()
	крона.bottom_radius = 1.0
	крона.top_radius = 0.02
	крона.height = 1.0
	крона.radial_segments = 7
	крона.rings = 1
	крона.material = _материал(Color(0.16, 0.24, 0.18))

	var стволы: Array = []
	var цвет_стволов: Array = []
	var ярусы: Array = [[], [], []]
	var цвета_ярусов: Array = [[], [], []]
	var точки: Array[Vector2] = [Vector2(7.0, -14.0), Vector2(9.6, -14.2)]
	var попытки := 0
	while точки.size() < ДЕРЕВЬЕВ and попытки < 2500:
		попытки += 1
		var x := rng.randf_range(-РАДИУС_ЛЕСА, РАДИУС_ЛЕСА)
		var z := rng.randf_range(-РАДИУС_ЛЕСА, РАДИУС_ЛЕСА)
		if _можно_сажать(x, z):
			точки.append(Vector2(x, z))
	for p in точки:
		var высота := rng.randf_range(12.0, 22.0)
		var ширина := rng.randf_range(0.75, 1.3)
		var поворот := rng.randf_range(0.0, TAU)
		var цвет := rng.randf_range(0.77, 1.11)
		стволы.append(Transform3D(
			Basis(Vector3.UP, поворот).scaled(Vector3(ширина, высота, ширина)),
			Vector3(p.x, высота * 0.5, p.y)))
		цвет_стволов.append(Color(0.24, 0.19, 0.15) * цвет)
		for j in range(3):
			var ширина_кроны := высота * (0.125 - j * 0.019) * rng.randf_range(0.88, 1.08)
			var длина := высота * (0.32 - j * 0.035)
			var центр := высота * (0.61 + j * 0.125)
			ярусы[j].append(Transform3D(
				Basis(Vector3.UP, поворот + j * 0.38).scaled(
					Vector3(ширина_кроны, длина, ширина_кроны)),
				Vector3(p.x, центр, p.y)))
			var тон := rng.randf_range(0.8, 1.05)
			цвета_ярусов[j].append(Color(0.085, 0.14, 0.10) * тон)
		# Коллизии нужны только возле поляны: вдали достаточно рендера.
		if Vector2(p.x, p.y).length_squared() < 23.0 * 23.0:
			_коллизия_ствола(p, высота)
	_множество("Стволы_лес", ствол, стволы, цвет_стволов)
	for j in range(3):
		_множество("Хвоя_ярус_%d" % j, крона, ярусы[j], цвета_ярусов[j])

func _коллизия_ствола(p: Vector2, высота: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Ствол_коллизия"
	body.position = Vector3(p.x, высота * 0.5, p.y)
	var shape := CollisionShape3D.new()
	var cylinder := CylinderShape3D.new()
	cylinder.radius = 0.37
	cylinder.height = высота
	shape.shape = cylinder
	body.add_child(shape)
	add_child(body)

func _тропа() -> void:
	# Накладная поверхность на плоском черновом грунте: коллизия земли остаётся.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(ТРОПА.size() - 1):
		var a: Vector2 = ТРОПА[i]
		var b: Vector2 = ТРОПА[i + 1]
		var dir := (b - a).normalized()
		var perp := Vector2(-dir.y, dir.x)
		var ширина_a := 0.73 + 0.08 * sin(float(i) * 2.1)
		var ширина_b := 0.73 + 0.08 * sin(float(i + 1) * 2.1)
		var al := a - perp * ширина_a
		var ar := a + perp * ширина_a
		var bl := b - perp * ширина_b
		var br := b + perp * ширина_b
		var c := Color(0.20, 0.17, 0.135) * rng.randf_range(0.89, 1.06)
		# Порядок вершин направлен вверх, чтобы тропа освещалась правильно.
		_треугольник(st, Vector3(al.x, 0.017, al.y), Vector3(ar.x, 0.017, ar.y),
			Vector3(bl.x, 0.017, bl.y), c)
		_треугольник(st, Vector3(bl.x, 0.017, bl.y), Vector3(ar.x, 0.017, ar.y),
			Vector3(br.x, 0.017, br.y), c)
	st.generate_normals()
	var mesh := st.commit()
	mesh.surface_set_material(0, _материал(Color(0.2, 0.17, 0.135)))
	var объект := MeshInstance3D.new()
	объект.name = "Лесная_тропа"
	объект.mesh = mesh
	add_child(объект)

func _треугольник(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, цвет: Color) -> void:
	st.set_color(цвет)
	st.add_vertex(a)
	st.set_color(цвет)
	st.add_vertex(b)
	st.set_color(цвет)
	st.add_vertex(c)

func _папоротник_меш() -> ArrayMesh:
	# Небольшие угловатые листья, без прозрачных билбордов.
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for k in range(6):
		var угол := TAU * float(k) / 6.0
		var d := Vector3(cos(угол), 0, sin(угол))
		var бок := Vector3(-d.z, 0, d.x)
		var осн := Vector3.ZERO
		var лев := d * 0.38 + бок * 0.17 + Vector3.UP * 0.41
		var прав := d * 0.38 - бок * 0.17 + Vector3.UP * 0.41
		var кончик := d * 0.82 + Vector3.UP * 0.17
		var зелёный := Color.WHITE
		_треугольник(st, осн, лев, прав, зелёный)
		_треугольник(st, лев, кончик, прав, зелёный)
	st.generate_normals()
	var mesh := st.commit()
	mesh.surface_set_material(0, _материал(Color(0.2, 0.29, 0.16)))
	return mesh

func _подлесок() -> void:
	var камень := SphereMesh.new()
	камень.radius = 0.5
	камень.height = 1.0
	камень.radial_segments = 8
	камень.rings = 4
	камень.material = _материал(Color(0.42, 0.41, 0.38))

	var папоротник := _папоротник_меш()
	var камни: Array = []
	var цвета_камней: Array = []
	var листья: Array = []
	var цвета_листьев: Array = []
	for i in range(600):
		var x := rng.randf_range(-32.0, 32.0)
		var z := rng.randf_range(-32.0, 32.0)
		if absf(x) < 5.5 and absf(z) < 4.5:
			continue
		if absf(z + 17.0) < 1.8:
			continue
		if _дистанция_до_тропы(x, z) < 1.65:
			continue
		if i % 3 == 0:
			var размер := rng.randf_range(0.23, 0.75)
			камни.append(Transform3D(
				Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(
					Vector3(размер * 1.5, размер * 0.52, размер)),
				Vector3(x, размер * 0.17, z)))
			цвета_камней.append(Color(0.28, 0.29, 0.28) * rng.randf_range(0.85, 1.15))
		else:
			var масштаб := rng.randf_range(0.30, 0.74)
			листья.append(Transform3D(
				Basis(Vector3.UP, rng.randf_range(0.0, TAU)).scaled(
					Vector3.ONE * масштаб), Vector3(x, 0.025, z)))
			цвета_листьев.append(Color(0.16, 0.21, 0.11) * rng.randf_range(0.75, 1.05))
	_множество("Камни_подлесок", камень, камни, цвета_камней)
	_множество("Папоротник_подлесок", папоротник, листья, цвета_листьев)

func _коновязь() -> void:
	# Не у дома — только между двумя соснами у ручья, скрыта с тропы.
	var body := StaticBody3D.new()
	body.name = "Коновязь_у_ручья"
	body.position = Vector3(8.3, 1.2, -14.1)
	body.set_meta("label", "Коновязь у ручья — жердь между двумя соснами. С тропы её не видно.")
	var mesh := CylinderMesh.new()
	mesh.bottom_radius = 0.08
	mesh.top_radius = 0.07
	mesh.height = 2.6
	mesh.radial_segments = 8
	mesh.material = _материал(Color(0.38, 0.28, 0.19))
	var visual := MeshInstance3D.new()
	visual.mesh = mesh
	visual.rotation.z = PI / 2.0
	body.add_child(visual)
	var collider := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.08
	shape.height = 2.6
	collider.shape = shape
	collider.rotation.z = PI / 2.0
	body.add_child(collider)
	add_child(body)

func _свет_из_двери() -> void:
	# Не фонарь с концепта: лишь слабый свет очага, падающий через дверь.
	var свет := OmniLight3D.new()
	свет.name = "Тёплый_свет_из_двери"
	свет.position = Vector3(1.36, 1.48, 3.45)
	свет.light_color = Color(1.0, 0.62, 0.34)
	свет.light_energy = 0.35
	свет.omni_range = 3.8
	свет.shadow_enabled = false
	add_child(свет)
