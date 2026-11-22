extends RefCounted

const WOOD_SHADER := preload("res://textures/wood_grain.gdshader")
const WIND_SHADER := preload("res://textures/foliage_wind.gdshader")
const SITE: Dictionary = preload("res://scripts/layout.gd").DATA.site

var rng := RandomNumberGenerator.new()
var world: Node3D
var terrain_height: Callable
var paths: Array[PackedVector2Array] = []

func populate(parent: Node3D, height_at: Callable) -> void:
	world = parent
	terrain_height = height_at
	rng.seed = 1026
	for route in [SITE.trail, SITE.access]:
		var points := PackedVector2Array()
		for point in route:
			points.append(Vector2(point[0], point[1]))
		paths.append(points)
	_build_trees()
	_build_understory()

func _ground(p: Vector2) -> Vector3:
	return Vector3(p.x, terrain_height.call(p.x, p.y), p.y)

func _path_distance_squared(p: Vector2) -> float:
	var minimum := 10000.0
	for route in paths:
		for i in range(1, route.size()):
			var nearest := Geometry2D.get_closest_point_to_segment(p, route[i-1], route[i])
			minimum = minf(minimum, nearest.distance_squared_to(p))
	return minimum

func _forest_site(p: Vector2) -> bool:
	if absf(p.x) < 6.3 and p.y > -6.6 and p.y < 7.5:
		return false
	if p.x > 5.3 and p.x < 11.8 and p.y > -15.05 and p.y < -9.95:
		return false
	return _path_distance_squared(p) > 1.28 and float(terrain_height.call(p.x,p.y)) > -2.47

func _segment(a: Vector3, b: Vector3, radius: float) -> Transform3D:
	var axis := b-a
	var basis := Basis(Quaternion(Vector3.UP, axis.normalized()))
	return Transform3D(basis.scaled_local(Vector3(radius, axis.length(), radius)), (a+b)*0.5)

func _foliage_transform(start: Vector3, end: Vector3, width: float) -> Transform3D:
	var axis := end-start
	var x := axis.normalized()
	var z := x.cross(Vector3.UP).normalized()
	var y := z.cross(x)
	return Transform3D(Basis(x*axis.length(), y*width, z*width), start)

func _build_trees() -> void:
	var clearings := [[-6.75,5.68],[7.95,4.05],[-6.8,-.15],[5.97,-4.38],[-6.52,-5.55]]
	var points: Array[Vector3] = []
	for seed_point in clearings + SITE.rail:
		points.append(_ground(Vector2(seed_point[0], seed_point[1])))
	for i in 365:
		var p := Vector2(rng.randf_range(-44,44), rng.randf_range(-44,44))
		if _forest_site(p):
			points.append(_ground(p))

	var trunks: Array[Transform3D] = []
	var branches: Array[Transform3D] = []
	var needles: Array[Transform3D] = []
	var needle_colors := PackedColorArray()
	var needle_dark := Color(0.086, 0.137, 0.107)
	var needle_light := Color(0.198, 0.245, 0.156)
	for p in points:
		var h := rng.randf_range(9.5, 19.3)
		var r := rng.randf_range(.13,.23) * (.58 + h/28.0)
		var lean := Vector3(rng.randf_range(-.76,.76),0,rng.randf_range(-.76,.76))
		var top := p + Vector3.UP * h + lean
		trunks.append(_segment(p, top, r))
		_add_trunk_collision(p, r, h)
		var dead := rng.randf() < .19
		var start := rng.randf_range(.16,.36) if dead else rng.randf_range(.33,.58)
		var count := rng.randi_range(8,13) if dead else rng.randi_range(15,21)
		var angle := rng.randf() * TAU
		for i in count:
			var level := float(i)/count
			var altitude := lerpf(start,.985,level)
			var origin := p.lerp(top,altitude)
			angle += 2.399963 + rng.randf_range(-.41,.41)
			var radial := Vector3(cos(angle),0,sin(angle))
			var reach := h * rng.randf_range(.11,.19) * (1.0-level*.86)
			var elbow := origin + radial * reach * .55 + Vector3.UP * reach * .10
			var tip := origin + radial * reach + Vector3.UP * reach * rng.randf_range(-.045,.24)
			branches.append(_segment(origin,elbow,maxf(.022,r * (.43-level*.26))))
			branches.append(_segment(elbow,tip,maxf(.011,r*.19)))
			if not dead and rng.randf() > .18 and reach > .38:
				var width := reach * rng.randf_range(.55,.87)
				needles.append(_foliage_transform(origin.lerp(elbow,.36),tip,width))
				needle_colors.append(needle_dark.lerp(needle_light,rng.randf_range(.10,.76)))
			else:
				var twig := elbow + radial * reach * .16 + Vector3.UP * reach * .38
				branches.append(_segment(elbow,twig,maxf(.008,r*.12)))

	var bark := ShaderMaterial.new()
	bark.shader = WOOD_SHADER
	bark.set_shader_parameter("long_axis",2)
	bark.set_shader_parameter("wood_color",Color(.37,.31,.25))
	bark.set_shader_parameter("grain_strength",.47)
	var bole := CylinderMesh.new()
	bole.bottom_radius = 1.0
	bole.top_radius = .12
	bole.height = 1.0
	bole.radial_segments = 8
	bole.rings = 0
	var twig_mesh := CylinderMesh.new()
	twig_mesh.bottom_radius = 1.0
	twig_mesh.top_radius = .37
	twig_mesh.height = 1.0
	twig_mesh.radial_segments = 5
	twig_mesh.rings = 0
	_instances("Стволы_и_сосны",bole,bark,trunks)
	_instances("Сучья",twig_mesh,bark,branches)
	_instances("Хвойные_лапы",_needle_mesh(),_wind(true),needles,needle_colors)

func _add_trunk_collision(p: Vector3, radius: float, height: float) -> void:
	var body := StaticBody3D.new()
	var shape := CollisionShape3D.new()
	var trunk := CylinderShape3D.new()
	trunk.height = minf(height,4.0)
	trunk.radius = radius*.83
	shape.shape = trunk
	body.position = p + Vector3.UP * trunk.height * .5
	body.add_child(shape)
	world.add_child(body)

func _needle_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(1,9):
		var t := i*.105
		var spread := sin(PI*t)*.57*(1.0-t*.35)
		for side in [-1.0,1.0]:
			var tip := Vector3(t+.18,-.04-i*.011,side*spread)
			var heel := Vector3(t-.10,.035,0)
			var spine := Vector3(t+.16,.045,0)
			_triangle(surface,heel,tip,spine,Color(.76,.79,.73),Color(.92,.92,.86),Color(1,1,1))
			_triangle(surface,heel+Vector3.UP*.065,tip*.93+Vector3.UP*.07,spine+Vector3.UP*.10,Color(.78,.80,.72),Color(.88,.89,.82),Color(1,1,1))
	surface.generate_normals()
	return surface.commit()

func _build_understory() -> void:
	var grasses: Array[Transform3D] = []
	var grass_colors := PackedColorArray()
	var bracken: Array[Transform3D] = []
	var bracken_colors := PackedColorArray()
	var litter: Array[Transform3D] = []
	var litter_colors := PackedColorArray()
	var stones: Array[Transform3D] = []
	var stone_colors := PackedColorArray()
	var fern_brown := Color(.346,.279,.177)
	var fern_green := Color(.27,.32,.197)
	for i in 6800:
		var near := i >= 4250
		var extent := 14.0 if near else 28.0
		var p := Vector2(rng.randf_range(-extent,extent),rng.randf_range(-19,12) if near else rng.randf_range(-29,30))
		if absf(p.x) < 4.7 and p.y > -3.7 and p.y < 4.2:
			continue
		var floor_point := _ground(p)
		if floor_point.y < -2.55:
			continue
		var path_squared := _path_distance_squared(p)
		var damp := sin(p.x*.79+p.y*.31)*.45 + sin(p.x*.45-p.y*.96)*.55
		var angle := rng.randf()*TAU
		var basis := Basis(Vector3.UP,angle)
		if path_squared > .25 and damp > -.38 and i%3 != 0:
			var h := rng.randf_range(.19,.57) * (1.0+damp*.33)
			grasses.append(Transform3D(basis.scaled_local(Vector3(h*.8,h,h*.8)),floor_point))
			grass_colors.append(fern_brown.lerp(fern_green,rng.randf_range(.09,.77)))
			if i%17==0 and path_squared > .53:
				var size := rng.randf_range(.40,.91)
				bracken.append(Transform3D(basis.scaled_local(Vector3.ONE*size),floor_point))
				bracken_colors.append(fern_green.lerp(fern_brown,rng.randf_range(.18,.72)))
		else:
			var size := rng.randf_range(.060,.210)
			litter.append(Transform3D(basis.scaled_local(Vector3(size, size * .48, size)),floor_point+Vector3.UP*.036))
			litter_colors.append(Color(.24,.178,.097).lerp(Color(.49,.364,.183),rng.randf()))
		if i % 29 == 0 and path_squared > .47:
			var size := rng.randf_range(.055,.23)
			var offset := Vector2(cos(angle),sin(angle)) * .36
			stones.append(Transform3D(basis.scaled_local(Vector3(size*1.6,size*.75,size)),_ground(p+offset)))
			stone_colors.append(Color(.27,.26,.23).lerp(Color(.42,.40,.35),rng.randf()))

	for raw in SITE.screen:
		var p := _ground(Vector2(raw[0],raw[1]))
		for i in 6:
			var angle := rng.randf()*TAU
			var offset := Vector3(cos(angle),0,sin(angle))*rng.randf_range(.05,.33)
			var scale := Vector3(1.0, rng.randf_range(1.25,2.42), 1.0)
			bracken.append(Transform3D(Basis(Vector3.UP,angle).scaled_local(scale),p+offset))
			bracken_colors.append(fern_green.lerp(Color(.225,.295,.178),rng.randf()))

	var stone_mesh := SphereMesh.new()
	stone_mesh.radius = .66
	stone_mesh.height = .85
	stone_mesh.radial_segments = 6
	stone_mesh.rings = 3
	var leaf_mat := _lit_cards()
	_instances("Сухая_трава",_grass_mesh(),_wind(),grasses,grass_colors,false)
	_instances("Папоротник_и_подлесок",_bracken_mesh(),_wind(),bracken,bracken_colors)
	_instances("Лесная_подстилка",_leaf_mesh(),leaf_mat,litter,litter_colors,false)
	_instances("Камни_среди_травы",stone_mesh,leaf_mat,stones,stone_colors)

func _grass_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 11:
		var blade := Vector3(cos(i*2.4),0,sin(i*2.4))
		var side := blade.cross(Vector3.UP)*(.017+float(i%3)*.009)
		var h := .55+float(i%5)*.102
		var foot := blade*.095
		var bend := blade*.27+Vector3.UP*h*.59
		var tip := blade*.43+Vector3.UP*h
		var dark := Color(.48,.49,.44)
		var light := Color(.94,.96,.85)
		_triangle(surface,foot-side,bend-side*.64,foot+side,dark,light,dark)
		_triangle(surface,foot+side,bend-side*.64,bend+side*.64,dark,light,light)
		_triangle(surface,bend-side*.64,tip,bend+side*.64,light,Color.WHITE,light)
	surface.generate_normals()
	return surface.commit()

func _fern_spine(direction: Vector3, size: float, t: float) -> Vector3:
	return direction*(t*.78*size) + Vector3.UP*(sin(t*2.11)*size*.81)

func _bracken_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 7:
		var direction := Vector3(cos(i*2.399963),0,sin(i*2.399963))
		var cross := direction.cross(Vector3.UP)
		var size := .84+.084*(i%4)
		for j in 12:
			var t := j/12.0
			var from := _fern_spine(direction,size,t)
			var to := _fern_spine(direction,size,(j+1)/12.0)
			var stalk := cross*(.008*(1.0-t)+.001)
			var green := Color(.63,.72,.46)
			_triangle(surface,from-stalk,to-stalk,from+stalk,green,green,green)
			_triangle(surface,from+stalk,to-stalk,to+stalk,green,green,green)
			if j < 2:
				continue
			for amount in [-1.0,1.0]:
				var broad := sin(t*PI)*(.177+.021*(i%3))
				var apex := from + cross*float(amount)*broad + direction*(.054+.055*t) + Vector3.UP*.013
				var along := apex-from
				var wing := Vector3(along.z,0,-along.x).normalized()
				var base := from.lerp(apex,.16)
				var pavilion := from.lerp(apex,.54)+Vector3.UP*.016
				var left := pavilion + wing*(.027*sin(t*PI)+.008) - Vector3.UP*.016
				var right := pavilion - wing*(.028*sin(t*PI)+.008) - Vector3.UP*.016
				var tips := Color(.86,.93,.64)
				var side := Color(.71,.80,.53)
				_triangle(surface,base,left,pavilion,green,side,tips)
				_triangle(surface,base,pavilion,right,green,tips,side)
				_triangle(surface,left,apex,pavilion,side,tips,tips)
				_triangle(surface,pavilion,apex,right,tips,tips,side)
	surface.generate_normals()
	return surface.commit()

func _wind(bough := false) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = WIND_SHADER
	material.set_shader_parameter("bough",bough)
	return material

func _leaf_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var mid := Vector3(0,.12,0)
	var front := Vector3(.72,0,0)
	var back := Vector3(-.53,.03,0)
	var left := Vector3(.0,.015,.27)
	var right := Vector3(.05,.015,-.31)
	for side in [left,right]:
		_triangle(surface,mid,side,front,Color.WHITE,Color(.77,.70,.60),Color(.83,.78,.71))
		_triangle(surface,mid,back,side,Color.WHITE,Color(.58,.53,.47),Color(.77,.70,.60))
	surface.generate_normals()
	return surface.commit()

func _triangle(surface: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, ca: Color, cb: Color, cc: Color) -> void:
	surface.set_color(ca)
	surface.add_vertex(a)
	surface.set_color(cb)
	surface.add_vertex(b)
	surface.set_color(cc)
	surface.add_vertex(c)

func _lit_cards() -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.vertex_color_use_as_albedo = true
	mat.roughness = .94
	return mat

func _instances(label: String, mesh: Mesh, mat: Material, transforms: Array[Transform3D], colors := PackedColorArray(), shadows := true) -> void:
	if transforms.is_empty():
		return
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.use_colors = not colors.is_empty()
	batch.mesh = mesh
	batch.instance_count = transforms.size()
	for i in transforms.size():
		batch.set_instance_transform(i,transforms[i])
		if batch.use_colors:
			batch.set_instance_color(i,colors[i])
	var node := MultiMeshInstance3D.new()
	node.name = label
	node.multimesh = batch
	node.material_override = mat
	if not shadows:
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	world.add_child(node)
