extends Node3D

const SITE: Dictionary = preload("res://scripts/layout.gd").DATA.site
const ROCKS := [
	preload("res://models/forest/rock_0.res"), preload("res://models/forest/rock_1.res"),
	preload("res://models/forest/rock_2.res"), preload("res://models/forest/rock_3.res"),
	preload("res://models/forest/rock_4.res"), preload("res://models/forest/rock_5.res"),
]
const DEAD_WOOD := [preload("res://models/forest/branch_0.res"), preload("res://models/forest/branch_1.res"),
	preload("res://models/forest/branch_2.res")]
const ROCK_TEXTURE := preload("res://textures/forest/rock.res")
const ROCK_NORMAL := preload("res://textures/forest/rock_n.res")
const DEAD_TEXTURE := preload("res://textures/forest/deadwood.res")
const DEAD_NORMAL := preload("res://textures/forest/deadwood_n.res")
const BARK := preload("res://textures/forest/pine_bark.res")
const WIND := preload("res://textures/foliage_wind.gdshader")
const SEDGE_TEXTURE := preload("res://textures/forest/grass.res")

var terrain: Node3D
var wood: StandardMaterial3D
var rock: StandardMaterial3D
var branch: StandardMaterial3D
var skin: StandardMaterial3D

func populate(landscape: Node3D) -> void:
	terrain = landscape
	rock = _material(Color(.85,.87,.76),ROCK_TEXTURE,ROCK_NORMAL)
	branch = _material(Color(.86,.82,.73),DEAD_TEXTURE,DEAD_NORMAL)
	wood = _material(Color(.69,.59,.48),BARK)
	wood.uv1_scale = Vector3(1.21,1.61,1.0)
	skin = _material(Color(.51,.361,.226))
	_place_outcrops()
	_undergrowth_by_water()
	_rail_and_rack()
	_cold_veil()

func _material(color: Color, texture: Texture2D = null, normal: Texture2D = null) -> StandardMaterial3D:
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	material.albedo_texture = texture
	material.roughness = .91
	if normal != null:
		material.normal_enabled = true
		material.normal_texture = normal
		material.normal_scale = .73
	return material

func _ground(x: float, z: float, lift := .0) -> Vector3:
	return Vector3(x,terrain.height_at(x,z)+lift,z)

func _mesh(label: String, geometry: Mesh, at: Vector3, material: Material) -> MeshInstance3D:
	var object := MeshInstance3D.new()
	object.name = label
	object.mesh = geometry
	object.material_override = material
	object.position = at
	add_child(object,true)
	return object

func _place_outcrops() -> void:
	for spot in [
		[-6.53,6.57,0,.42,-.94],[-5.47,6.84,2,.27,.55],[5.81,6.57,3,.23,-.45],
		[10.52,5.19,1,.35,1.51],[10.34,4.50,5,.23,-.61],[6.77,-2.88,4,.28,-2.38],
		[10.68,-5.69,3,.31,2.76],[5.77,-8.62,4,.23,-1.4],[-3.92,-13.77,2,.36,1.22],
		[-4.91,-15.71,4,.34,-.49],[-3.39,-15.74,5,.22,.8],[-2.39,-16.12,0,.21,-1.48],
		[-3.65,-17.24,1,.20,-.08],[-1.52,-17.65,2,.28,.37],[1.95,-15.89,3,.31,.76],
		[5.7,-15.3,5,.31,-.8],[10.45,-15.6,2,.34,.11],[12.13,-16.2,1,.46,1.93],
		[-5.23,-19.53,3,.51,2.73],[3.33,-18.4,4,.45,1.85],[-9.33,-16.3,5,.35,.34],
	]:
		var at := _ground(spot[0],spot[1],.035)
		var scale := float(spot[3])
		var slab := _mesh("Камень_во_мху",ROCKS[int(spot[2])],at,rock)
		slab.scale = Vector3(scale,scale*.94,scale)
		slab.rotation.y = spot[4]

	for log in [
		[-4.6,6.58,2,2.38,1.1],[-5.28,7.37,1,1.28,-.6],[6.24,5.28,1,1.58,-.85],
		[9.35,2.27,0,1.34,.52],[-5.92,-4.94,2,2.45,-.93],[6.78,-6.82,1,1.4,-1.30],
		[3.87,-10.36,0,1.62,.51],[-3.98,-12.91,2,2.05,1.45],[4.14,-16.17,1,1.22,.04],
		[8.32,-19.81,2,3.71,1.35],[-6.35,-18.91,1,1.38,-1.15],
	]:
		var limb := _mesh("Валежник",DEAD_WOOD[int(log[2])],_ground(log[0],log[1],.033),branch)
		limb.rotation.y = log[4]
		limb.scale = Vector3.ONE*float(log[3])

func _undergrowth_by_water() -> void:
	var shape := SurfaceTool.new()
	shape.begin(Mesh.PRIMITIVE_TRIANGLES)
	for index in 4:
		var a := index*2.399963
		var side := Vector3(cos(a),0,sin(a))*.47
		var foot := Vector3(sin(a),0,-cos(a))*.085
		var tip := foot+Vector3.UP*(.72+.099*(index%3))
		var vertices := [foot-side,foot+side,tip-side,tip+side]
		var base := float(index%2)*.5
		var uv := [Vector2(base+.003,1),Vector2(base+.497,1),Vector2(base+.003,0),Vector2(base+.497,0)]
		for i in [0,1,2,1,3,2]:
			shape.set_uv(uv[i])
			shape.set_color(Color(.68,.67,.49) if i<2 else Color(.86,.87,.69))
			shape.add_vertex(vertices[i])
	shape.generate_normals()
	var at := RandomNumberGenerator.new()
	at.seed = 2679
	var clusters: Array[Transform3D] = []
	var colors := PackedColorArray()
	for section in [SITE.lower,SITE.upper]:
		var factor := 1.0 if section == SITE.lower else -1.0
		for i in 189:
			var x := at.randf_range(-24.0,25.0)
			var z: float = terrain.bank_z(x,section) + factor*at.randf_range(.18,1.42)
			var moisture := .5+.5*sin(x*.82+z*.44)
			if moisture < .29 or (absf(x+3.0)<.72 and factor>0.0):
				continue
			var size := at.randf_range(.49,1.16)
			var basis := Basis(Vector3.UP,at.randf()*TAU).scaled_local(Vector3(size*.79,size*.91,size*.79))
			clusters.append(Transform3D(basis,_ground(x,z,.025)))
			colors.append(Color(.62,.66,.45).lerp(Color(.91,.88,.65),at.randf()))
	var grass := MultiMesh.new()
	grass.transform_format = MultiMesh.TRANSFORM_3D
	grass.use_colors = true
	grass.mesh = shape.commit()
	grass.instance_count = clusters.size()
	for i in clusters.size():
		grass.set_instance_transform(i,clusters[i])
		grass.set_instance_color(i,colors[i])
	var tuft := MultiMeshInstance3D.new()
	tuft.name = "Осока_по_берегам"
	tuft.multimesh = grass
	var material := ShaderMaterial.new()
	material.shader = WIND
	material.set_shader_parameter("bend",.80)
	material.set_shader_parameter("textured",true)
	material.set_shader_parameter("leaf_surface",SEDGE_TEXTURE)
	tuft.material_override = material
	tuft.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(tuft)

func _pole(label: String, start: Vector3, finish: Vector3, radius: float) -> void:
	var stick := CylinderMesh.new()
	stick.height = start.distance_to(finish)
	stick.bottom_radius = radius
	stick.top_radius = radius*.79
	stick.radial_segments = 10
	var piece := _mesh(label,stick,(start+finish)*.5,wood)
	piece.quaternion = Quaternion(Vector3.UP,(finish-start).normalized())

func _rail_and_rack() -> void:
	var pair: Array = SITE.rail
	var start := _ground(pair[0][0],pair[0][1],1.12)
	var finish := _ground(pair[1][0],pair[1][1],1.12)
	_pole("Коновязь",start,finish,.068)
	var endpoints: Array = SITE.rack
	var left := _ground(endpoints[0][0],endpoints[0][1])
	var right := _ground(endpoints[1][0],endpoints[1][1])
	for base in [left,right]:
		_pole("Стойка_сушилки",base-Vector3.UP*.035,base+Vector3.UP*1.52,.053)
	for level in [1.04,1.42]:
		_pole("Перекладина",left+Vector3.UP*level,right+Vector3.UP*level,.042)
	for i in 2:
		var hide := SurfaceTool.new()
		hide.begin(Mesh.PRIMITIVE_TRIANGLES)
		var profile := [Vector2(-.032,0.0),Vector2(.035,-.031),Vector2(.13,-.23),
			Vector2(.105,-.30),Vector2(.16,-.47),Vector2(.086,-.40),Vector2(0,-.57),
			Vector2(-.065,-.41),Vector2(-.14,-.47),Vector2(-.092,-.29),Vector2(-.135,-.22)]
		for j in profile.size():
			var p: Vector2 = profile[j]
			var q: Vector2 = profile[(j+1)%profile.size()]
			var l := Vector3(p.x,p.y,sin(j*1.8)*.027)
			var r := Vector3(q.x,q.y,sin((j+1)%profile.size()*1.8)*.027)
			var c := Vector3(-.013,-.262,.026)
			for v in [l,r,c,l,c,r]:
				hide.add_vertex(v)
		hide.generate_normals()
		_mesh("Заячья_шкура",hide.commit(),left.lerp(right,.27+i*.40)+Vector3.UP*(1.38-i*.03),skin)

func _cold_veil() -> void:
	var volume := FogVolume.new()
	volume.name = "Туман_над_ручьём"
	volume.size = Vector3(67,2.7,12.8)
	volume.shape = RenderingServer.FOG_VOLUME_SHAPE_ELLIPSOID
	volume.position = Vector3(.7,-1.43,-17.5)
	var haze := FogMaterial.new()
	haze.density = .066
	haze.albedo = Color(.74,.80,.83)
	haze.height_falloff = .38
	haze.edge_fade = 1.22
	volume.material = haze
	add_child(volume)
