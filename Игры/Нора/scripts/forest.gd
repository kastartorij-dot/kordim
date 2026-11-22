extends RefCounted

const BARK_SHADER := preload("res://textures/forest_bark.gdshader")
const BARK := preload("res://textures/forest/pine_bark.res")
const PINE_TWIG := preload("res://textures/forest/pine_twig.res")
const FERN_TEXTURE := preload("res://textures/forest/fern.res")
const GRASS_TEXTURE := preload("res://textures/forest/grass.res")
const FERNS := [preload("res://models/forest/fern_0.res"), preload("res://models/forest/fern_1.res"), preload("res://models/forest/fern_2.res"), preload("res://models/forest/fern_3.res")]
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
	_build_bare_trees()
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
	var clearings := [[-6.65,5.76],[8.88,7.54],[7.03,2.52],[-6.24,-.65],[5.86,-4.62],[-6.34,-5.53],[-3.4,9.0]]
	var points: Array[Vector3] = []
	for seed_point in clearings + SITE.rail:
		points.append(_ground(Vector2(seed_point[0], seed_point[1])))
	for i in 365:
		var p := Vector2(rng.randf_range(-44,44), rng.randf_range(-44,44))
		if _forest_site(p):
			points.append(_ground(p))

	var adults := points.size()
	for spot in [[-5.65,3.8],[5.85,5.53],[10.15,4.3],[10.28,1.6],[7.40,-1.9],[5.98,-5.52],[-5.88,-7.08],[4.42,-11.65],[4.34,-13.15],[7.69,-9.93],[8.83,-10.45],[9.68,-10.07],[10.74,-12.1],[11.8,-13.48],[-4.90,-14.16],[-9.40,-12.41],[-6.15,7.84]]:
		var p := Vector2(spot[0],spot[1])
		if _path_distance_squared(p) > .83:
			points.append(_ground(p))

	var trunks: Array[Transform3D] = []
	var branches: Array[Transform3D] = []
	var needles: Array[Transform3D] = []
	var needle_colors := PackedColorArray()
	var needle_dark := Color(.50,.62,.49)
	var needle_light := Color(.75,.87,.65)
	for tree in points.size():
		var p := points[tree]
		var small := tree >= adults
		var h := rng.randf_range(2.55,4.90) if small else rng.randf_range(9.8,20.6)
		var r := rng.randf_range(.066,.095) if small else rng.randf_range(.17,.31) * (.52 + h/27.0)
		var lean := Vector3(rng.randf_range(-.76,.76),0,rng.randf_range(-.76,.76))
		var top := p + Vector3.UP * h + lean
		trunks.append(_segment(p, top, r))
		_add_trunk_collision(p, r, h)
		if tree < 9 or (not small and absf(p.x)<17.0 and p.z>-21.0 and p.z<14.0):
			for root in range(4):
				var direction := root*1.68+tree*2.41
				var reach := r*rng.randf_range(2.35,3.2)
				var tip := p+Vector3(cos(direction)*reach,-.02,sin(direction)*reach)
				branches.append(_segment(p+Vector3.UP*r*.7,tip,r*.51))
		var dead := not small and rng.randf() < .15
		var start := .076 if small else (rng.randf_range(.16,.35) if dead else rng.randf_range(.30,.53))
		var count := rng.randi_range(25,36) if small else (rng.randi_range(8,13) if dead else rng.randi_range(19,27))
		var angle := rng.randf() * TAU
		for i in count:
			var level := float(i)/count
			var offset := sin(i*9.46+tree*2.75)*(.041 if small else .034)
			var altitude := clampf(lerpf(start,.985,level)+offset,start,.989)
			var origin := p.lerp(top,altitude)
			angle += 2.399963 + rng.randf_range(-.41,.41)
			var radial := Vector3(cos(angle),0,sin(angle))
			var reach := h * rng.randf_range(.18,.257) * (1.0-level*.84) if small else h * rng.randf_range(.125,.215) * (1.0-level*.81)
			reach *= .84+.25*cos(angle+tree*1.66)+.13*sin(i*4.32+tree)
			var side := Vector3(-radial.z,0,radial.x) * reach * (.14*sin(i*5.51+tree*1.39))
			var elbow := origin + radial * reach * .55 + Vector3.UP * reach * .10 + side
			var tip := origin + radial * reach + Vector3.UP * reach * rng.randf_range(-.15,.27) - side*.5
			branches.append(_segment(origin,elbow,maxf(.022,r * (.43-level*.26))))
			branches.append(_segment(elbow,tip,maxf(.011,r*.19)))
			if not dead and rng.randf() > .105 and reach > .23:
				var width := reach * rng.randf_range(.76,1.08)
				needles.append(_foliage_transform(origin.lerp(elbow,.36),tip,width))
				needle_colors.append(needle_dark.lerp(needle_light,rng.randf_range(.10,.76)))
			else:
				var twig := elbow + radial * reach * .16 + Vector3.UP * reach * .38
				branches.append(_segment(elbow,twig,maxf(.008,r*.12)))

	var bark := ShaderMaterial.new()
	bark.shader = BARK_SHADER
	bark.set_shader_parameter("pine_bark",BARK)
	var bole := CylinderMesh.new()
	bole.bottom_radius = 1.0
	bole.top_radius = .12
	bole.height = 1.0
	bole.radial_segments = 11
	bole.rings = 0
	var twig_mesh := CylinderMesh.new()
	twig_mesh.bottom_radius = 1.0
	twig_mesh.top_radius = .37
	twig_mesh.height = 1.0
	twig_mesh.radial_segments = 5
	twig_mesh.rings = 0
	_instances("Стволы_и_сосны",bole,bark,trunks)
	_instances("Сучья",twig_mesh,bark,branches)
	_instances("Хвойные_лапы",_needle_mesh(),_wind(true,PINE_TWIG),needles,needle_colors)

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

func _build_bare_trees() -> void:
	var stems: Array[Transform3D] = []
	var limbs: Array[Transform3D] = []
	var anchors := [[-6.93,7.63],[-4.52,8.28],[-8.38,4.96],[11.25,8.02],
		[11.4,.28],[10.96,-6.72],[6.17,-12.0],[-5.95,-10.25],[-7.48,-15.25],
		[-7.11,-20.89],[-9.64,-23.26],[3.35,-22.98],[7.73,-23.95],[12.9,-20.75],
		[17.2,-23.5],[-14.95,-18.82],[-18.45,-8.30],[-9.78,-4.28]]
	for i in anchors.size():
		var position := Vector2(anchors[i][0],anchors[i][1])
		if _path_distance_squared(position)<1.42:
			continue
		var p := _ground(position)
		var angle := i*2.109
		var tilt := Vector3(cos(angle),0,sin(angle))
		var h := 7.85 + sin(i*1.61)*2.58 + i%4*.37
		var mid := p+Vector3.UP*h*.46+tilt*.17
		var fork := p+Vector3.UP*h*.74+tilt*.63
		var top := p+Vector3.UP*h+tilt*.52+Vector3(.18,0,.06)
		var base := .129+(i%5)*.017
		stems.append(_segment(p,mid,base))
		stems.append(_segment(mid,fork,base*.72))
		stems.append(_segment(fork,top,base*.42))
		_add_trunk_collision(p,base,h)
		for j in 10:
			var a := angle + j*2.399963
			var root := mid.lerp(fork,j/8.0) if j<8 else fork.lerp(top,(j-7)*.29)
			var length := h*(.24-j*.014)*(1.0 + .16*sin(j*2.4+i))
			var sweep := Vector3(cos(a),.48+.20*cos(i+j*1.20),sin(a))
			_bare_fork(limbs,root,sweep,length,.051-j*.0031,j+i*11,2)
	var bark := ShaderMaterial.new()
	bark.shader = BARK_SHADER
	bark.set_shader_parameter("pine_bark",BARK)
	bark.set_shader_parameter("desaturate",.69)
	var trunk := CylinderMesh.new()
	trunk.height = 1.0
	trunk.bottom_radius = 1.0
	trunk.top_radius = .62
	trunk.radial_segments = 8
	trunk.rings = 0
	var twig := CylinderMesh.new()
	twig.height = 1.0
	twig.bottom_radius = 1.0
	twig.top_radius = .34
	twig.radial_segments = 5
	twig.rings = 0
	_instances("Осенний_сухостой",trunk,bark,stems)
	_instances("Развилки_сухих_веток",twig,bark,limbs)

func _bare_fork(limbs: Array[Transform3D], at: Vector3, bend: Vector3, reach: float, width: float, seed: int, depth: int) -> void:
	var horizontal := Vector3(bend.x,0,bend.z)
	var first := at+(horizontal*.56 + Vector3.UP*bend.y*.37)*reach
	var tip := at+(horizontal+Vector3.UP*bend.y)*reach
	limbs.append(_segment(at,first,width))
	limbs.append(_segment(first,tip,maxf(.006,width*.53)))
	if depth==0 or reach<.32:
		return
	for side in [-1.0,1.0]:
		var a := float(side)*(.47+.17*sin(seed*1.9))
		var turn := horizontal.rotated(Vector3.UP,a)*.83+Vector3.UP*(bend.y*.69+.34)
		var t := .11 if side<0.0 else .58
		_bare_fork(limbs,first.lerp(tip,t),turn,reach*(.49+t*.15),width*.45,seed+depth*7,depth-1)

func _needle_mesh() -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 7:
		var t := .13+i*.119
		var side := -1.0 if i%2==0 else 1.0
		var lean := side*(.76-i*.070)
		var direction := Vector3(cos(lean),.08*sin(i*2.6),sin(lean)).normalized()
		var cross := Vector3(-direction.z,.23*side,direction.x).normalized()
		var base := Vector3(t,-.021*sin(i*1.37),.0)
		var top := base+direction*(.48-i*.037)
		var width := cross*(.152-i*.009)
		_twig_card(surface,base,top,width,false)
		var upright := (width*.34+Vector3.UP*(.12-i*.007))*1.15
		_twig_card(surface,base,top,upright,true)
	surface.generate_normals()
	return surface.commit()

func _twig_card(surface: SurfaceTool, base: Vector3, tip: Vector3, width: Vector3, reverse: bool) -> void:
	var positions := [base-width,base+width,tip-width,tip+width]
	var flip := 1.0 if reverse else 0.0
	var uv := [Vector2(0,flip),Vector2(0,1.-flip),Vector2(1,flip),Vector2(1,1.-flip)]
	for i in [0,1,2,1,3,2]:
		surface.set_uv(uv[i])
		surface.set_color(Color(.78,.82,.73) if i < 2 else Color(.94,.97,.86))
		surface.add_vertex(positions[i])

func _build_understory() -> void:
	var grasses: Array[Transform3D] = []
	var grass_colors := PackedColorArray()
	var fern_points: Array[Array] = [[],[],[],[]]
	var fern_tints: Array[PackedColorArray] = [PackedColorArray(),PackedColorArray(),PackedColorArray(),PackedColorArray()]
	var litter: Array[Transform3D] = []
	var litter_colors := PackedColorArray()
	var dry := Color(.86,.80,.65)
	var green := Color(.61,.67,.48)
	for i in 8450:
		var close := i > 3800
		var margin := 14.6 if close else 37.0
		var p := Vector2(rng.randf_range(-margin,margin),rng.randf_range(-22,14) if close else rng.randf_range(-33,34))
		if absf(p.x) < 4.79 and p.y > -3.91 and p.y < 4.36:
			continue
		var floor_point := _ground(p)
		if floor_point.y < -2.52:
			continue
		var path_squared := _path_distance_squared(p)
		var damp := sin(p.x*.73+p.y*.31)*.48 + sin(p.x*.42-p.y*.89)*.52
		var angle := rng.randf()*TAU
		var basis := Basis(Vector3.UP,angle)
		if path_squared > .32 and damp > -.48 and i%3 != 0:
			var h := rng.randf_range(.10,.42) * (1.0+damp*.44)
			var spread := .30 + h*.22
			grasses.append(Transform3D(basis.scaled_local(Vector3(spread,h,spread*.79)),floor_point))
			grass_colors.append(dry.lerp(green,rng.randf_range(.04,.90)))
			if i%17==0 and path_squared > .64:
				var size := rng.randf_range(.48,1.26)
				_add_fern(fern_points,fern_tints,floor_point,basis,Vector3.ONE*size)
		elif path_squared > .16 and i%3 == 0:
			var size := rng.randf_range(.036,.110)
			litter.append(Transform3D(basis.scaled_local(Vector3(size,size*.34,size)),floor_point+Vector3.UP*.024))
			litter_colors.append(Color(.28,.190,.083).lerp(Color(.59,.38,.18),rng.randf()))

	for raw in SITE.screen + [[7.2,-10.36],[8.15,-10.13],[8.55,-10.71],[9.45,-10.33]]:
		var p := _ground(Vector2(raw[0],raw[1]))
		for i in 5:
			var angle := rng.randf()*TAU
			var shift := Vector2(cos(angle),sin(angle))*rng.randf_range(.08,.44)
			var point := _ground(Vector2(p.x,p.z)+shift)
			var scale := Vector3(1.10,rng.randf_range(1.42,1.94),1.13)
			_add_fern(fern_points,fern_tints,point,Basis(Vector3.UP,angle),scale)

	var fern_material := _wind(false,FERN_TEXTURE)
	for index in FERNS.size():
		var group: Array[Transform3D] = []
		group.assign(fern_points[index])
		_instances("Папоротник_"+str(index+1),FERNS[index],fern_material,group,fern_tints[index])
	_instances("Сухая_трава",_grass_mesh(),_wind(false,GRASS_TEXTURE),grasses,grass_colors,false)
	_instances("Опавшие_листья",_leaf_mesh(),_lit_cards(),litter,litter_colors,false)

func _add_fern(places: Array[Array], tints: Array[PackedColorArray], at: Vector3, basis: Basis, scale: Vector3) -> void:
	var variant := rng.randi_range(0,FERNS.size()-1)
	places[variant].append(Transform3D(basis.scaled_local(scale),at))
	var colors := tints[variant]
	colors.append(Color(.59,.62,.42).lerp(Color(.91,.94,.76),rng.randf_range(.19,.92)))
	tints[variant] = colors

func _grass_mesh() -> ArrayMesh:
	var shape := SurfaceTool.new()
	shape.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 4:
		var yaw := i*2.4
		var x := Vector3(cos(yaw),0,sin(yaw))
		var lean := Vector3(-sin(yaw),0,cos(yaw))
		var extent := x*(.46+.05*(i%2))
		var base := lean*.10
		var rise := Vector3.UP*(.78+(i%3)*.079)+lean*.17
		var corners := [base-extent,base+extent,base+rise-extent,base+rise+extent]
		var half := .5*(i%2)
		var uv := [Vector2(half+.004,.999),Vector2(half+.496,.999),Vector2(half+.004,.002),Vector2(half+.496,.002)]
		for j in [0,1,2,1,3,2]:
			shape.set_color(Color(.70,.67,.58) if j < 2 else Color(.94,.93,.83))
			shape.set_uv(uv[j])
			shape.add_vertex(corners[j])
	shape.generate_normals()
	return shape.commit()

func _wind(bough := false, texture: Texture2D = null) -> ShaderMaterial:
	var material := ShaderMaterial.new()
	material.shader = WIND_SHADER
	material.set_shader_parameter("bough",bough)
	if texture != null:
		material.set_shader_parameter("textured",true)
		material.set_shader_parameter("leaf_surface",texture)
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
