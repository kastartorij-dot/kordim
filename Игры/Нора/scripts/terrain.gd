extends Node3D

const SITE: Dictionary = preload("res://scripts/layout.gd").DATA.site
const SOIL := preload("res://textures/forest_soil.gdshader")
const WATER := preload("res://textures/creek_surface.gdshader")
const LITTER := preload("res://textures/forest/litter.res")
const LITTER_NORMAL := preload("res://textures/forest/litter_n.res")
const TREAD := preload("res://textures/forest/trail.res")
const TREAD_NORMAL := preload("res://textures/forest/trail_n.res")
const WATER_LEVEL := -2.65
const HALF_WIDTH := 46.0
const GRID_STEP := .5

var main_route := PackedVector2Array()
var side_route := PackedVector2Array()
var elevation := FastNoiseLite.new()

func build() -> void:
	elevation.seed = 3128
	elevation.frequency = .161
	elevation.fractal_octaves = 3
	main_route = _route(SITE.trail)
	side_route = _route(SITE.access)
	_make_ground()
	_make_creek()

func _route(points: Array) -> PackedVector2Array:
	var line := PackedVector2Array()
	for point in points:
		line.append(Vector2(point[0],point[1]))
	return line

func _distance_sq(point: Vector2, track: PackedVector2Array) -> float:
	var closest := 1000.0
	for index in range(1, track.size()):
		var p := Geometry2D.get_closest_point_to_segment(point,track[index-1],track[index])
		closest = minf(closest,point.distance_squared_to(p))
	return closest

func bank_z(x: float, bank: Array) -> float:
	var first: Array = bank.front()
	var last: Array = bank.back()
	if x < first[0]:
		var t: float = x-first[0]
		return first[1]+sin(t*.196)*.98+sin(t*.093)*.74
	if x > last[0]:
		var t: float = x-last[0]
		return last[1]+sin(t*.174)*1.30-sin(t*.075)*.52
	for i in range(1,bank.size()):
		var a: Array = bank[i-1]
		var b: Array = bank[i]
		if x <= b[0]:
			return lerpf(a[1],b[1],inverse_lerp(a[0],b[0],x))
	return last[1]

func height_at(x: float, z: float) -> float:
	var near := bank_z(x,SITE.lower)
	var far := bank_z(x,SITE.upper)
	if z < near and z > far:
		return WATER_LEVEL-.09-.37*sin(PI*inverse_lerp(far,near,z))
	var shore_distance := minf(absf(z-near),absf(z-far))
	var bank_fade := smoothstep(0.0,1.8,shore_distance)
	var wave := elevation.get_noise_2d(x,z)
	var shelf := sin(x*.19+z*.234)*sin(z*.34-x*.077)
	if z <= far:
		var rise := smoothstep(far,far-5.6,z)
		return lerpf(WATER_LEVEL-.085,-.94,rise)+bank_fade*(.29*shelf+.42*wave)
	var wall_clearance := maxf(absf(x)-4.57,absf(z)-3.74)
	var verge := smoothstep(.07,2.8,wall_clearance)
	var grade := lerpf(-1.97,0.0,smoothstep(-13.0,-5.45,z))
	var lip := smoothstep(0.0,2.14,shore_distance)
	var near_bank := minf(grade,lerpf(WATER_LEVEL-.085,-1.92,lip))
	var mound := exp(-(pow((x+6.93)/4.8,2.)+pow((z+7.97)/5.1,2.)))*.70
	mound += exp(-(pow((x-11.1)/3.8,2.)+pow((z+6.0)/4.9,2.)))*.51
	var near_ford := 1.0-smoothstep(-13.16,-12.05,z)
	var tread_fade := lerpf(.31,1.0,smoothstep(.26,1.56,absf(x+2.69)))
	var steps := lerpf(1.0,tread_fade,near_ford)
	var hummocks := (wave*.44+shelf*.19+mound)*verge*bank_fade*steps
	return (near_bank if z < -13.0 else grade)+hummocks

func _ground_channels(x: float, z: float, height: float) -> Color:
	var here := Vector2(x,z)
	var worn := 0.0
	if x > -5.0 and x < 10.0 and z > -16.8 and z < 9.5:
		var path_distance := sqrt(_distance_sq(here,main_route))
		var shortcut := sqrt(_distance_sq(here,side_route))
		worn = maxf(1.0-smoothstep(.22,.78,path_distance),(1.0-smoothstep(.17,.51,shortcut))*.49)
	# Ground immediately around the doorstep sees more foot traffic.
	var doorstep := Vector2(1.43,3.86).distance_to(here)
	worn = maxf(worn,(1.0-smoothstep(.29,1.45,doorstep))*.78)
	var moist := 1.0-smoothstep(.16,2.09,absf(height-WATER_LEVEL))
	var growth := clampf(.46+elevation.get_noise_2d(x*.61,z*.61)*.73 + .16*sin(x*.31-z*.51),0,1)
	return Color(worn,moist,growth,1.0)

func _make_ground() -> void:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var grid := roundi(HALF_WIDTH*2.0/GRID_STEP)
	for z_index in range(grid+1):
		var z := -HALF_WIDTH+z_index*GRID_STEP
		for x_index in range(grid+1):
			var x := -HALF_WIDTH+x_index*GRID_STEP
			var height := height_at(x,z)
			surface.set_uv(Vector2(x,z))
			surface.set_color(_ground_channels(x,z,height))
			surface.add_vertex(Vector3(x,height,z))
	for z_index in grid:
		var z := -HALF_WIDTH+z_index*GRID_STEP
		for x_index in grid:
			var x := -HALF_WIDTH+x_index*GRID_STEP
			if x >= -4.0 and x < 0.0 and z >= -1.0 and z < 3.0:
				continue
			var a := z_index*(grid+1)+x_index
			var b := a+grid+1
			for index in [a,a+1,b,a+1,b+1,b]:
				surface.add_index(index)
	surface.generate_normals()
	surface.generate_tangents()
	var mat := ShaderMaterial.new()
	mat.shader = SOIL
	mat.set_shader_parameter("leaf_litter",LITTER)
	mat.set_shader_parameter("leaf_normal",LITTER_NORMAL)
	mat.set_shader_parameter("trail_soil",TREAD)
	mat.set_shader_parameter("trail_normal",TREAD_NORMAL)
	_mesh("Поляна_и_лесная_тропа",surface,mat).create_trimesh_collision()

func _make_creek() -> void:
	var water := SurfaceTool.new()
	water.begin(Mesh.PRIMITIVE_TRIANGLES)
	var depths := [0.0,.42,.88,1.0,.88,.42,0.0]
	var sections := roundi(HALF_WIDTH*2.0/GRID_STEP)
	for i in range(sections+1):
		var x := -HALF_WIDTH+i*GRID_STEP
		var a := bank_z(x,SITE.upper)
		var b := bank_z(x,SITE.lower)
		for lane in depths.size():
			var t := float(lane)/(depths.size()-1)
			var z := lerpf(a,b,t)
			water.set_uv(Vector2(x,z))
			water.set_color(Color(1,1,1,depths[lane]))
			water.add_vertex(Vector3(x,WATER_LEVEL,z))
	for i in sections:
		for lane in range(depths.size()-1):
			var a := i*depths.size()+lane
			var b := a+depths.size()
			for index in [a,b,a+1,b,b+1,a+1]:
				water.add_index(index)
	water.generate_normals()
	water.generate_tangents()
	var mat := ShaderMaterial.new()
	mat.shader = WATER
	_mesh("Ручей",water,mat)

func _mesh(label: String, surface: SurfaceTool, material: Material) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.name = label
	instance.mesh = surface.commit()
	instance.material_override = material
	add_child(instance)
	return instance
