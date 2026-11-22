extends SceneTree

const WOOL := preload("res://textures/wool_curtain.gdshader")
const ROOF := preload("res://textures/moss_shakes.gdshader")
const PLANKS := preload("res://textures/hewn_planks.gdshader")
const ROUGH_GRAIN := preload("res://textures/weathered/rough_wood_d.res")
const ROUGH_NORMAL := preload("res://textures/weathered/rough_wood_n.res")
const WOOD := preload("res://textures/wood_grain.gdshader")
const LINEN := preload("res://textures/linen_weave.gdshader")
const FLAME := preload("res://textures/live_flame.gdshader")
const COAL := preload("res://textures/hearth_coal.gdshader")
const STONE := preload("res://textures/hewn_stone.gdshader")
const SMOKE := preload("res://textures/chimney_smoke.gdshader")

var rng := RandomNumberGenerator.new()
var clay: StandardMaterial3D
var slip: StandardMaterial3D
var iron: StandardMaterial3D
var ash: StandardMaterial3D
var wax: StandardMaterial3D
var board: ShaderMaterial
var masonry: ShaderMaterial

func _initialize() -> void:
	call_deferred("_build")

func _build() -> void:
	rng.seed = 1026
	clay = _mat(Color(.51,.315,.223),.67)
	slip = _mat(Color(.34,.296,.241),.73)
	iron = _mat(Color(.217,.210,.201),.62,.68)
	ash = _mat(Color(.19,.161,.137),.94)
	wax = _mat(Color(.72,.60,.39),.87)
	board = _shader(WOOD)
	board.set_shader_parameter("wood_color",Color(.41,.305,.195))
	board.set_shader_parameter("grain_strength",.29)
	masonry = _shader(STONE)
	var assets := {
		"table": _table(),
		"bench": _bench_frame(),
		"alchemy": _alchemy(),
		"workbench": _workbench(),
		"grace-bed": _bedding(Color(.39,.33,.254),Color(.234,.174,.135),0.12),
		"nikto-bed": _bedding(Color(.322,.334,.281),Color(.212,.246,.218),0.50),
		"arn-bed": _bedding(Color(.44,.374,.266),Color(.284,.208,.138),0.81),
		"hearth": _hearth(),
		"smoke": _smoke(),
		"porch": _porch(),
		"rafters": _rafters(),
		"roof": _roof(),
		"curtains": _curtains(),
		"nook": _sleeping_nook(),
		"joinery": _joinery(),
		"river-rock": _river_rock(),
	}
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://models/dressing"))
	var selection := OS.get_cmdline_user_args()
	var saved := 0
	for id in assets:
		var root: Node3D = assets[id]
		if not selection.is_empty() and not id in selection:
			root.free()
			continue
		_own(root,root)
		var packed := PackedScene.new()
		var error := packed.pack(root)
		if error == OK:
			error = ResourceSaver.save(packed,"res://models/dressing/"+id+".scn",ResourceSaver.FLAG_COMPRESS)
		root.free()
		if error != OK:
			printerr(id,": ",error)
			quit(error)
			return
		saved += 1
	print("Собрано моделей: ",saved)
	quit()

func _own(root: Node, parent: Node) -> void:
	for child in parent.get_children():
		child.owner = root
		_own(root,child)

func _mat(color: Color, roughness: float, metallic := 0.0) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.vertex_color_use_as_albedo = true
	result.albedo_color = color
	result.roughness = roughness
	result.metallic = metallic
	return result

func _shader(shader: Shader) -> ShaderMaterial:
	var result := ShaderMaterial.new()
	result.shader = shader
	return result

func _mesh(parent: Node3D, title: String, shape: Mesh, material: Material, at: Vector3) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.name = title
	part.mesh = shape
	part.material_override = material
	part.position = at
	parent.add_child(part,true)
	return part

func _group(parent: Node3D, title: String, at := Vector3.ZERO) -> Node3D:
	var group := Node3D.new()
	group.name = title
	group.position = at
	if parent != null:
		parent.add_child(group,true)
	return group

func _point(surface: SurfaceTool, p: Vector3, color: Color, uv := Vector2.ZERO) -> void:
	surface.set_uv(uv)
	surface.set_color(color)
	surface.add_vertex(p)

func _lathe(profile: Array, segments := 32, spout := 0.0, shade := 0.0) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var points := PackedVector3Array()
	var colors := PackedColorArray()
	var uv := PackedVector2Array()
	var top: float = profile[0].y
	for row in profile:
		top = maxf(top,row.y)
	for j in profile.size():
		var p: Vector2 = profile[j]
		for i in range(segments+1):
			var angle := TAU*i/segments
			var warped := .997 + .012*sin(angle*3.0 + shade) + .008*cos(angle*5.0+p.y*18.0)
			var lip := clampf((p.y-top*.74)/maxf(top*.26,.001),0,1)*pow(maxf(cos(angle),0),12.0)
			var radius := p.x*warped + lip*spout*.48
			points.append(Vector3(cos(angle)*radius,p.y+lip*spout*.27,sin(angle)*radius))
			var streak := .82 + .078*sin(j*2.38+shade) + .043*sin(angle*4.3 + j*.84)
			streak *= 1.0 + lip*.055
			colors.append(Color(streak,streak*.949,streak*.90))
			uv.append(Vector2(float(i)/segments,float(j)/maxi(1,profile.size()-1)))
	var stride := segments+1
	for j in range(profile.size()-1):
		for i in segments:
			var a := j*stride+i
			for k in [a,a+1,a+stride,a+1,a+stride+1,a+stride]:
				_point(surface,points[k],colors[k],uv[k])
	surface.index()
	surface.generate_normals()
	return surface.commit()

func _tube(points: PackedVector3Array, radius: float, sides := 9) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := PackedVector3Array()
	for i in points.size():
		var direction := (points[mini(i+1,points.size()-1)]-points[maxi(0,i-1)]).normalized()
		var basis := Basis(Quaternion(Vector3.UP,direction))
		for j in sides:
			var angle := TAU*j/sides
			var r := radius*(.83+.16*sin(PI*float(i)/maxi(1,points.size()-1)))
			rings.append(points[i]+basis*Vector3(cos(angle)*r,0,sin(angle)*r))
	for i in range(points.size()-1):
		for j in sides:
			var a := i*sides+j
			var b := i*sides+(j+1)%sides
			for k in [a,b,a+sides,b,b+sides,a+sides]:
				_point(surface,rings[k],Color.WHITE)
	surface.index()
	surface.generate_normals()
	return surface.commit()

func _block(size: Vector3, bevel: float, tint: Color, seed_value := 0.0, rough := .0) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var half := size*.5
	var inner := half-Vector3.ONE*bevel
	for n in [Vector3.RIGHT,Vector3.LEFT,Vector3.UP,Vector3.DOWN,Vector3.FORWARD,Vector3.BACK]:
		var helper := Vector3.UP if absf(n.y) < .5 else Vector3.RIGHT
		var u: Vector3 = helper.cross(n).normalized()
		var v: Vector3 = n.cross(u)
		var step_u: float = absf(u.dot(half))
		var step_v: float = absf(v.dot(half))
		var u_positions: Array[float] = [-step_u, -step_u+bevel, step_u-bevel, step_u]
		var v_positions: Array[float] = [-step_v, -step_v+bevel, step_v-bevel, step_v]
		var surface_center: Vector3 = n*absf(n.dot(half))
		var grid := PackedVector3Array()
		for y in v_positions:
			for x in u_positions:
				var p: Vector3 = surface_center+u*x+v*y
				var c: Vector3 = p.clamp(-inner,inner)
				var q: Vector3 = c+(p-c).normalized()*bevel
				var distortion := Vector3(sin(q.y*13.9+q.z*17.3+seed_value),cos(q.z*19.5+q.x*13.2+seed_value),sin(q.x*21.7+q.y*17.0+seed_value))
				grid.append(q+distortion*rough)
		for row in 3:
			for col in 3:
				var i := row*4+col
				for j in [i,i+4,i+1,i+1,i+4,i+5]:
					var p := grid[j]
					var wear: float = .89+.085*sin(seed_value+p.x*9.5+p.y*7.5+p.z*9.2)
					_point(surface,p,tint*wear)
	surface.index()
	surface.generate_normals()
	return surface.commit()

func _pane(parent: Node3D, title: String, size: Vector2, at: Vector3, material: Material, yaw: float) -> MeshInstance3D:
	var card := QuadMesh.new()
	card.size = size
	var part := _mesh(parent,title,card,material,at)
	part.rotation.y = yaw
	part.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return part

func _flame(parent: Node3D, at: Vector3, span: Vector2, amount: float, phase: float) -> void:
	var material := _shader(FLAME)
	material.set_shader_parameter("phase",phase)
	material.set_shader_parameter("strength",amount)
	for i in 3:
		_pane(parent,"Язык_огня",span,at+Vector3.UP*(span.y*.5),material,i*PI/3)

func _candle(parent: Node3D, at: Vector3, height: float, glow := .32) -> void:
	var item := _group(parent,"Огарок",at)
	var candle_profile := [Vector2(.022,0),Vector2(.027,.006),Vector2(.026,height*.52),Vector2(.024,height*.93),Vector2(.017,height),Vector2(.006,height*.93),Vector2(0,height*.92)]
	_mesh(item,"Воск",_lathe(candle_profile,23,0,.35),wax,Vector3.ZERO)
	_mesh(item,"Блюдце",_lathe([Vector2(0,-.010),Vector2(.043,-.010),Vector2(.056,.001),Vector2(.055,.011),Vector2(.048,.012),Vector2(.040,-.001),Vector2(0,-.002)]),iron,Vector3.ZERO)
	_mesh(item,"Фитиль",_tube(PackedVector3Array([Vector3(0,height-.004,0),Vector3(.003,height+.009,.002)]),.0033),ash,Vector3.ZERO)
	_flame(item,Vector3(.003,height+.007,.001),Vector2(.034,.063),.93,height*6)
	if glow > .0:
		var light := OmniLight3D.new()
		light.name = "Свет"
		light.position = Vector3(.018,height+.11,0)
		light.light_color = Color(1.0,.74,.44)
		light.light_energy = glow
		light.omni_range = 2.5
		item.add_child(light)

func _bowl(parent: Node3D, title: String, at: Vector3, radius: float, height: float, material: Material, variation: float) -> void:
	var profile := [
		Vector2(0,0),Vector2(radius*.45,0),Vector2(radius*.56,height*.1),
		Vector2(radius*.63,height*.22),Vector2(radius*.82,height*.57),Vector2(radius*.96,height*.86),
		Vector2(radius,height*.96),Vector2(radius*.98,height),Vector2(radius*.93,height*.99),
		Vector2(radius*.92,height*.87),Vector2(radius*.73,height*.46),Vector2(radius*.49,height*.22),
		Vector2(radius*.24,height*.17),Vector2(0,height*.18),
	]
	_mesh(parent,title,_lathe(profile,32,0,variation),material,at)

func _pitcher(parent: Node3D, at: Vector3) -> void:
	var jug := _group(parent,"Кувшин",at)
	jug.rotation.y = -.38
	var profile := [
		Vector2(0,0),Vector2(.067,0),Vector2(.073,.015),Vector2(.092,.063),Vector2(.099,.106),
		Vector2(.092,.155),Vector2(.077,.184),Vector2(.058,.202),Vector2(.052,.231),Vector2(.055,.257),
		Vector2(.067,.274),Vector2(.069,.282),Vector2(.063,.286),Vector2(.056,.278),Vector2(.047,.259),
		Vector2(.046,.229),Vector2(.052,.202),Vector2(.082,.153),Vector2(.088,.109),Vector2(.065,.039),Vector2(0,.028),
	]
	_mesh(jug,"Глиняный_корпус",_lathe(profile,36,.084,.76),clay,Vector3.ZERO)
	var handle := PackedVector3Array()
	for step in range(15):
		var a := PI*step/14.0
		handle.append(Vector3(-.067-.078*sin(a),.159+.067*cos(a),.010+.009*sin(a)))
	_mesh(jug,"Ручка",_tube(handle,.015),clay,Vector3.ZERO)
	var band := TorusMesh.new()
	band.inner_radius = .087
	band.outer_radius = .092
	band.rings = 28
	band.ring_segments = 8
	_mesh(jug,"Ободок",band,slip,Vector3(0,.139,0))

func _spoon(parent: Node3D, at: Vector3, angle: float) -> void:
	var spoon := _group(parent,"Деревянная_ложка",at)
	spoon.rotation.y = angle
	var shape := _lathe([Vector2(0,.005),Vector2(.016,.007),Vector2(.032,.012),Vector2(.039,.019),Vector2(.034,.022),Vector2(.021,.014),Vector2(0,.012)],22,0,angle)
	var cup := _mesh(spoon,"Черпак",shape,board,Vector3(.075,0,0))
	cup.scale = Vector3(1.20,1.0,.87)
	var grip := PackedVector3Array([Vector3(-.104,.011,.008),Vector3(-.04,.014,.005),Vector3(.046,.019,0)])
	_mesh(spoon,"Резная_ручка",_tube(grip,.008,8),board,Vector3.ZERO)

func _cloth(size: Vector2, fall: float, phase: float, side_start := .38) -> ArrayMesh:
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var points := PackedVector3Array()
	var uv := PackedVector2Array()
	var colors := PackedColorArray()
	for z in range(23):
		var v := z/22.0
		for x in range(17):
			var u := x/16.0
			var cross := u-.5
			var line := v-.5
			var down := pow(clampf((absf(cross)-side_start)/(.5-side_start),0.0,1.0),1.65)
			var folds := sin(u*24.0+v*4.1+phase)*.012 + sin(v*35.0+u*5.1+phase)*.006
			folds += sin(v*9.0+u*7.0+phase)*.015
			var edge := pow(absf(cross)*2,7)
			points.append(Vector3(cross*size.x+edge*.018*sin(v*35.0+phase),folds-down*fall,line*size.y+.024*sin(u*11.4+phase)))
			uv.append(Vector2(u,v))
			var fleck := .50+.27*sin(u*21+v*5.8+phase)*sin(v*20.0+u*6.9)
			colors.append(Color(fleck,fleck,fleck))
	for z in 22:
		for x in 16:
			var a := z*17+x
			for i in [a,a+1,a+17,a+1,a+18,a+17]:
				_point(surface,points[i],colors[i],uv[i])
	surface.index()
	surface.generate_normals()
	return surface.commit()

func _fabric(base: Color, seam: Color, strength := .8) -> ShaderMaterial:
	var fabric := _shader(LINEN)
	fabric.set_shader_parameter("dye",base)
	fabric.set_shader_parameter("trim",seam)
	fabric.set_shader_parameter("lining",strength)
	return fabric

func _table() -> Node3D:
	var root := _group(null,"Утварь")
	var y := .784
	_table_frame(root)
	var linen := _fabric(Color(.57,.482,.34),Color(.38,.181,.123),.92)
	var towel := _mesh(root,"Льняное_полотенце",_cloth(Vector2(1.05,.31),.17,.42),linen,Vector3(-.58,y+.017,.038))
	towel.rotation.y = PI*.5
	_bowl(root,"Миска_у_лавки",Vector3(.25,y,.23),.122,.053,slip,.63)
	_bowl(root,"Миска_у_дальнего_края",Vector3(-.45,y+.032,-.24),.101,.040,clay,1.46)
	_pitcher(root,Vector3(.65,y,-.24))
	_bowl(root,"Чашка",Vector3(.68,y,.205),.064,.071,clay,1.8)
	_spoon(root,Vector3(-.14,y,.17),.34)
	_spoon(root,Vector3(-.67,y+.032,-.057),-1.27)
	_candle(root,Vector3(.065,y,-.265),.101,.29)
	var bread := _group(root,"Хлеб_на_доске",Vector3(-.40,y+.040,.23))
	bread.rotation.y = -.22
	_mesh(bread,"Разделочная_доска",_block(Vector3(.320,.026,.204),.008,Color(.97,.91,.85),.50),board,Vector3.ZERO)
	var crust := _mat(Color(.46,.287,.126),.97)
	var crumb := _mat(Color(.60,.478,.285),.91)
	_mesh(bread,"Корка",_block(Vector3(.196,.073,.123),.032,Color.WHITE,1.1,.006),crust,Vector3(-.029,.046,.008))
	_mesh(bread,"Срез_хлеба",_block(Vector3(.013,.061,.100),.005,Color.WHITE,1.7,.002),crumb,Vector3(.067,.043,.008))
	for i in 7:
		var at := Vector3(rng.randf_range(.030,.142),.017,rng.randf_range(-.087,-.042))
		_mesh(bread,"Крошка",_block(Vector3(.006,.005,.007),.001,Color.WHITE,float(i)),crumb,at)
	return root

func _bottle(parent: Node3D, title: String, at: Vector3, width: float, height: float, color: Color) -> void:
	var body := _group(parent,title,at)
	var glass := _mat(color,.38,.06)
	var profile := [
		Vector2(0,0),Vector2(width*.71,0),Vector2(width*.88,.009),Vector2(width,height*.22),
		Vector2(width*.98,height*.48),Vector2(width*.78,height*.64),Vector2(width*.35,height*.76),
		Vector2(width*.32,height*.93),Vector2(width*.39,height*.96),Vector2(width*.39,height),
		Vector2(width*.28,height),Vector2(width*.26,height*.89),Vector2(0,height*.88),
	]
	_mesh(body,"Стекло",_lathe(profile,27,0.0,width*15.0),glass,Vector3.ZERO)
	_mesh(body,"Пробка",_lathe([Vector2(0,0),Vector2(width*.24,0),Vector2(width*.29,.019),Vector2(0,.020)],14),board,Vector3.UP*(height-.009))

func _alchemy() -> Node3D:
	var root := _group(null,"Склянки_и_инструмент")
	var y := .707
	_bottle(root,"Зелёная_склянка",Vector3(-.52,y,.152),.058,.211,Color(.215,.360,.273))
	_bottle(root,"Жёлтая_склянка",Vector3(-.343,y,.166),.047,.165,Color(.41,.264,.112))
	_bottle(root,"Малая_тёмная_склянка",Vector3(-.20,y,.189),.043,.118,Color(.236,.250,.202))
	_bowl(root,"Ступка",Vector3(-.27,y,-.096),.088,.071,slip,.48)
	var pestle := PackedVector3Array([Vector3(-.31,y+.025,-.123),Vector3(-.24,y+.090,-.073),Vector3(-.17,y+.108,-.043)])
	_mesh(root,"Пестик",_tube(pestle,.016),board,Vector3.ZERO)
	var cloth := _fabric(Color(.425,.371,.29),Color(.235,.182,.116),.30)
	for i in 2:
		var p := Vector3(.055+i*.157,y,-.112+i*.098)
		var bag_profile := [Vector2(0,0),Vector2(.049,0),Vector2(.068,.024),Vector2(.064,.061),Vector2(.032,.080),Vector2(.022,.097),Vector2(.027,.113),Vector2(0,.114)]
		_mesh(root,"Мешочек",_lathe(bag_profile,18),cloth,p)
		var twine := TorusMesh.new()
		twine.inner_radius = .019
		twine.outer_radius = .024
		twine.rings = 16
		twine.ring_segments = 7
		_mesh(root,"Бечева",twine,board,p+Vector3.UP*.095)
	_alchemy_supplies(root,y)
	_candle(root,Vector3(.48,y,.118),.067,.38)
	return root

func _workbench() -> Node3D:
	var root := _group(null,"Инструмент_Арна")
	var y := .885
	var rough := _mat(Color(.41,.319,.221),.93)
	for i in 3:
		var strip := _mesh(root,"Щепа",_block(Vector3(.015,.006,.27),.002,Color.WHITE,float(i),.001),rough,Vector3(-.22+i*.075,y,.34-i*.075))
		strip.rotation.y = .14 + .30*i
	var handle := PackedVector3Array([Vector3(.228,y+.025,-.11),Vector3(.175,y+.028,.010),Vector3(.068,y+.030,.173)])
	_mesh(root,"Рукоять_киянки",_tube(handle,.018),board,Vector3.ZERO)
	var hammer := _mesh(root,"Обух_киянки",_block(Vector3(.175,.064,.093),.014,Color.WHITE,.59,.003),board,Vector3(.04,y+.036,.197))
	hammer.rotation.y = -.70
	var file := _mesh(root,"Напильник",_block(Vector3(.030,.013,.235),.004,Color.WHITE,.408),iron,Vector3(-.181,y+.009,-.333))
	file.rotation.y = .44
	var grip := _mesh(root,"Рукоять_напильника",_block(Vector3(.033,.026,.073),.011,Color.WHITE,.615),board,Vector3(-.248,y+.012,-.479))
	grip.rotation.y = .44
	for i in 10:
		var at := Vector3(rng.randf_range(-.24,.25),y+.003,rng.randf_range(.285,.701))
		_mesh(root,"Стружка",_block(Vector3(.021,.007,.016),.002,Color.WHITE,float(i),.002),rough,at).rotation.y = rng.randf()*TAU
	for shelf in 2:
		for i in 3:
			var height := 1.394+shelf*.290
			var at := Vector3(-.385,height,-.51+i*.285+shelf*.096)
			if (i+shelf)%3==0:
				_bowl(root,"Горшочек",at,.050,.057,slip,i+shelf*.2)
			else:
				_bottle(root,"Склянка_на_полке",at,.031+i*.005,.097+shelf*.019,Color(.30,.268,.175))
	_tools_and_offcuts(root,y)
	return root

func _tools_and_offcuts(root: Node3D, y: float) -> void:
	var oak := _aged_board(Color(.74,.60,.45))
	var fresh_cut := _aged_board(Color(.99,.81,.60))
	var wooden_piece := _mesh(root,"Заготовка_на_чурке",_block(Vector3(.222,.052,.516),.012,Color(.88,.77,.65),2.33,.004),fresh_cut,Vector3(-.247,y+.027,.384))
	wooden_piece.rotation.y = -.09
	var plane := _group(root,"Деревянный_рубанок",Vector3(-.247,y+.052,.393))
	plane.rotation.y = -.09
	_mesh(plane,"Колодка",_block(Vector3(.095,.056,.218),.012,Color.WHITE,2.18,.003),oak,Vector3(0,.029,0))
	_mesh(plane,"Клин",_block(Vector3(.043,.055,.036),.007,Color.WHITE,2.18,.002),fresh_cut,Vector3(0,.066,-.008)).rotation.x = -.49
	_mesh(plane,"Железко",_block(Vector3(.041,.007,.068),.001,Color.WHITE,2.18),iron,Vector3(0,.061,-.038)).rotation.x = -.51

	var saw := _group(root,"Ручная_пила",Vector3(.200,y+.016,.420))
	saw.rotation.y = -.29
	var steel := _mat(Color(.304,.291,.265),.54,.58)
	var saw_mesh := SurfaceTool.new()
	saw_mesh.begin(Mesh.PRIMITIVE_TRIANGLES)
	for t in 23:
		var from := .018+t*.013
		var to := from+.013
		var left := -.056+.105*from
		var right := .042-.077*from
		for point in [Vector3(left,0,from),Vector3(left,0,to),Vector3(right,0,from),
			Vector3(right,0,from),Vector3(left,0,to),Vector3(right,0,to),
			Vector3(left,0,from),Vector3(left-.007,0,from+.010),Vector3(left,0,to)]:
			_point(saw_mesh,point,Color.WHITE)
	saw_mesh.generate_normals()
	steel.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mesh(saw,"Полотно_с_зубцами",saw_mesh.commit(),steel,Vector3.ZERO)
	_mesh(saw,"Расклёпанная_рукоять",_block(Vector3(.088,.037,.144),.017,Color.WHITE,2.91,.003),oak,Vector3(0,.006,-.064))

	var rack := _group(root,"Упоры_и_деревянные_колышки",Vector3(-.33,y-.002,-.55))
	_mesh(rack,"Корыто",_block(Vector3(.116,.028,.297),.009,Color.WHITE,4.12,.004),oak,Vector3.ZERO)
	for side in [-1.0,1.0]:
		_mesh(rack,"Борт_лотка",_block(Vector3(.014,.044,.31),.004,Color.WHITE,6.22),oak,Vector3(side*.056,.018,0))
	for i in 7:
		var at := Vector3((i%3-1)*.026,.019,-.107+i*.031)
		_mesh(rack,"Колышек",_block(Vector3(.016,.019,.086),.006,Color.WHITE,float(i)),fresh_cut,at).rotation.y = -.73+float(i%3)*.9

	var shavings := _mat(Color(.55,.389,.228),.92)
	for i in 9:
		var at := Vector3(-.12+sin(i*2.23)*.11,y+.008,.58+cos(i*1.73)*.14)
		var shaving := PackedVector3Array()
		for j in 15:
			var a := j*.34
			shaving.append(at+Vector3(cos(a)*(.028-.0006*j),j*.0018,sin(a)*(.035-.0008*j)))
		_mesh(root,"Свёрнутая_стружка",_tube(shaving,.0027,5),shavings,Vector3.ZERO)
	var make_do := _group(root,"Короб_с_обрезками_кожи",Vector3(.07,.268,.429))
	_mesh(make_do,"Основание",_block(Vector3(.30,.071,.251),.012,Color.WHITE,3.1,.004),oak,Vector3.UP*.047)
	var hide := _fabric(Color(.307,.214,.131),Color(.218,.144,.096),.37)
	for i in 3:
		var piece := _mesh(make_do,"Сложенный_обрезок",_cloth(Vector2(.24,.16),.018,1.49*i),hide,
			Vector3(-.044+i*.047,.09+i*.016,.021*i))
		piece.rotation.y = i*.26-.15
	var spare := _group(root,"Обрезки_под_верстаком",Vector3(.143,.282,-.18))
	for i in 5:
		var at := Vector3(.030*sin(i*2.1),i*.038,cos(i*2.2)*.086)
		_mesh(spare,"Плашка",_block(Vector3(.166,.035,.548-i*.048),.007,Color.WHITE,i*1.15,.004),fresh_cut,at).rotation.y = sin(i*3.3)*.23
	var rail := Vector3(-.424,1.09,-.48)
	_hewn_member(root,"Планка_для_инструмента",rail,rail+Vector3.BACK*.91,Vector2(.11,.052),oak)
	for i in 4:
		var at := rail + Vector3(.055,-.028,i*.163+.18)
		_mesh(root,"Вбитый_штырь",_tube(PackedVector3Array([at,at+Vector3(.058,.007,0)]),.011,7),oak,Vector3.ZERO)
		if i == 3:
			break
		var shaft := PackedVector3Array([at+Vector3(.053,-.019,-.012),at+Vector3(.047,-.15,.013),at+Vector3(.050,-.225,.032)])
		_mesh(root,"Стамеска_на_держателе",_tube(shaft,.011,8),oak,Vector3.ZERO)
		_mesh(root,"Жало",_block(Vector3(.013,.082,.027),.004,Color.WHITE,i),iron,shaft[2]-Vector3.UP*.027)

func _alchemy_supplies(root: Node3D, y: float) -> void:
	var linen := _fabric(Color(.432,.362,.25),Color(.254,.186,.124),.7)
	var cloth := _mesh(root,"Сложенная_тряпица",_cloth(Vector2(.36,.36),.02,2.0),linen,Vector3(.24,y+.017,-.070))
	cloth.rotation.y = .17
	var tray := _group(root,"Лоток_со_склянками",Vector3(-.353,y,.17))
	var oak := _aged_board(Color(.63,.55,.43))
	_mesh(tray,"Донышко",_block(Vector3(.497,.016,.159),.005,Color.WHITE,3.0,.002),oak,Vector3.ZERO)
	for side in [-1.0,1.0]:
		_mesh(tray,"Борт",_block(Vector3(.497,.030,.016),.004,Color.WHITE,3.0,.002),oak,Vector3(0,.015,side*.080))
		_mesh(tray,"Торец",_block(Vector3(.018,.031,.146),.004,Color.WHITE,4.0,.002),oak,Vector3(side*.251,.015,0))
	var cork := _mat(Color(.38,.293,.167),.94)
	for i in 3:
		var at := Vector3(-.023+i*.049,y+.014,.218+.024*sin(i*2.2))
		_mesh(root,"Пробка_на_столе",_block(Vector3(.030,.025,.032),.006,Color.WHITE,float(i),.002),cork,at).rotation.y = sin(i*1.7)*.62
	var jar := _group(root,"Керамический_горшочек",Vector3(.535,y,-.153))
	_bowl(jar,"Горшочек",Vector3.ZERO,.073,.066,clay,.42)
	_mesh(jar,"Крышечка",_lathe([Vector2(0,.027),Vector2(.025,.025),Vector2(.071,.005),Vector2(.067,0),Vector2(0,0)],24),slip,Vector3.UP*.065)
	var sleeve := _fabric(Color(.356,.302,.22),Color(.26,.185,.113),.50)
	_mesh(root,"Свёрток_сырья_на_нижней_полке",_lathe([Vector2(0,0),Vector2(.080,.008),Vector2(.093,.043),
		Vector2(.069,.098),Vector2(.03,.114),Vector2(.028,.135),Vector2(0,.14)],18),sleeve,Vector3(-.47,.043,.059))
	var leaf := _mat(Color(.329,.329,.143),.99)
	for i in 6:
		var at := Vector3(.30+sin(i*4.8)*.068,y+.028,-.155+cos(i*2.7)*.062)
		_mesh(root,"Сухой_лист",_block(Vector3(.017,.004,.045),.002,Color.WHITE,float(i),.001),leaf,at).rotation.y = i*1.81

func _sleeping_nook() -> Node3D:
	var root := _group(null,"У_топчана_Арна")
	var felt := _fabric(Color(.33,.26,.184),Color(.21,.135,.089),.73)
	var extra_blanket := _mesh(root,"Свёрнутое_одеяло",_cloth(Vector2(.66,.48),.11,2.28),felt,Vector3(-.01,.616,.51))
	extra_blanket.rotation.y = -.048
	var canvas := _fabric(Color(.43,.365,.268),Color(.235,.189,.121),.48)
	var knapsack := _group(root,"Потёртая_сумка",Vector3(-.54,.052,1.35))
	knapsack.rotation.y = -.44
	_mesh(knapsack,"Корпус",_block(Vector3(.327,.275,.172),.056,Color.WHITE,2.18,.009),canvas,Vector3.UP*.13)
	_mesh(knapsack,"Клапан",_cloth(Vector2(.318,.251),.063,.31),canvas,Vector3(0,.263,.039))
	var strap := PackedVector3Array([Vector3(-.127,.19,-.034),Vector3(-.111,.369,-.067),
		Vector3(.018,.398,-.075),Vector3(.121,.310,-.056),Vector3(.123,.116,-.053)])
	_mesh(knapsack,"Ремень",_tube(strap,.010,8),_mat(Color(.256,.158,.100),.95),Vector3.ZERO)
	return root

func _bedding(tint: Color, hem: Color, phase: float) -> Node3D:
	var root := _group(null,"Одеяло_и_подушка")
	var cloth := _fabric(tint,hem,1.0)
	_mesh(root,"Шерстяное_одеяло",_cloth(Vector2(1.09,1.48),.186,phase),cloth,Vector3(0,.559,.185))
	var flax := _fabric(Color(.51,.448,.358),Color(.36,.31,.23),.2)
	var pillow := _mesh(root,"Сбитая_подушка",_block(Vector3(.56,.112,.32),.054,Color.WHITE,phase,.016),flax,Vector3(.039,.544,-.725))
	pillow.rotation.y = phase*.15-.067
	return root

func _stone(parent: Node3D, size: Vector3, at: Vector3, tone: float, seed_value: float) -> void:
	var bevel := minf(.027,minf(size.x,minf(size.y,size.z))*.2)
	var warm := Color(tone,tone*.92,tone*.81)
	_mesh(parent,"Тёсаный_камень",_block(size,bevel,warm,seed_value,.012),masonry,at)

func _rim(root: Node3D, w: float, d: float, y: float, height: float, center: float, count: int) -> void:
	var t := float(count%7)
	for side in [-1.0,1.0]:
		for j in range(4):
			var cuts: Array[float] = [-d/2,-d*.24,-d*.02,d*.24,d/2]
			for k in range(1,4):
				cuts[k] += sin(count*2.5+k*1.3+side)*.063
			var depth: float = cuts[j+1]-cuts[j]
			var at := Vector3(center+side*(w*.5-.09),y,(cuts[j+1]+cuts[j])*.5)
			_stone(root,Vector3(.18,height-.008,depth-.011),at,.38+.29*rng.randf(),t+j)
		for j in range(2):
			var width := w*.5-.154
			var at := Vector3(center+(j-.5)*(width+.018),y,side*(d*.5-.085))
			_stone(root,Vector3(width-.013,height-.009,.17),at,.39+.24*rng.randf(),2+t+j)

func _hearth() -> Node3D:
	var root := _group(null,"Кладка_и_угли")
	for z in 5:
		for x in 3:
			var center := Vector3(-.41+x*.408,.074,-.730+z*.365)
			_stone(root,Vector3(.402,.148,.357),center,.57+rng.randf()*.22,x*3.4+z)
	for row in 6:
		var y := .231+row*.184
		for i in 4:
			var z := -.58+.384*i
			_stone(root,Vector3(.205,.178,.378),Vector3(-.491,y,z),.22+rng.randf()*.235,i+row*13.5)
		for z in [-1.0,1.0]:
			var join := -.042+sin(row*2.44+z)*.11
			_stone(root,Vector3(join+.49,.177,.30),Vector3((join-.49)/2.0,y,z*(.724+sin(row)*.019)),.36+.27*rng.randf(),row*5.0)
			_stone(root,Vector3(.552-join,.177,.285),Vector3((join+.56)/2.0,y,z*(.719+cos(row)*.019)),.48+.28*rng.randf(),row*1.5+z)
	for z in 7:
		_stone(root,Vector3(1.05,.148,.261),Vector3(-.069,1.231,-.789+z*.264),.51+rng.randf()*.25,z)
	for i in 21:
		var taper := smoothstep(0.0,7.0,float(i))
		_rim(root,lerpf(1.05,.643,taper),lerpf(1.69,.779,taper),1.481+i*.177,.176,lerpf(-.08,-.27,taper),i)
	var coal := _shader(COAL)
	var bed := _block(Vector3(.633,.038,.775),.015,Color.WHITE,1.4,.012)
	_mesh(root,"Зола_и_угли",bed,coal,Vector3(-.018,.178,0))
	for i in 19:
		var size := rng.randf_range(.035,.091)
		var at := Vector3(rng.randf_range(-.25,.34),.183+rng.randf()*.035,rng.randf_range(-.34,.35))
		var fragment := _mesh(root,"Уголёк",_block(Vector3(size,.028,size*.71),.011,Color.WHITE,i,.008),coal,at)
		fragment.rotation.y = rng.randf()*TAU
	var char := _mat(Color(.145,.118,.099),.96)
	for i in 5:
		var cross := Vector3(sin(i*2.18)*.37,.030,cos(i*2.18)*.39)
		var at := Vector3(.036+(i%2)*.057,.228+i*.017,sin(i)*.161)
		var log := PackedVector3Array([at-cross*.54,at+Vector3(.021,.006,-.025),at+cross*.54])
		var size := .045+rng.randf()*.024
		_mesh(root,"Обгоревшее_полено",_tube(log,size,9),char,Vector3.ZERO)
		_mesh(root,"Раскалённый_торец",_block(Vector3(size*1.20,.044,size*1.07),.016,Color.WHITE,i,.006),coal,log[2])
	for i in 3:
		var at := Vector3(.053+i*.076,.201+.023*i,-.19+i*.18)
		_flame(root,at,Vector2(.302-i*.026,.434+i*.046),.98,i*.382)
	var pot := [
		Vector2(0,0),Vector2(.094,0),Vector2(.151,.032),Vector2(.190,.107),Vector2(.202,.169),
		Vector2(.197,.188),Vector2(.205,.202),Vector2(.20,.212),Vector2(.180,.211),Vector2(.184,.188),
		Vector2(.167,.09),Vector2(.094,.040),Vector2(0,.027),
	]
	_mesh(root,"Чугунок",_lathe(pot,36,0,.73),iron,Vector3(.128,.607,0))
	var bail := PackedVector3Array()
	for i in range(17):
		var theta := PI*i/16.0
		bail.append(Vector3(.128,.782+.173*sin(theta),.201*cos(theta)))
	_mesh(root,"Дужка",_tube(bail,.012),iron,Vector3.ZERO)
	for i in 7:
		var ring := TorusMesh.new()
		ring.inner_radius = .015
		ring.outer_radius = .021
		ring.rings = 13
		ring.ring_segments = 7
		var link := _mesh(root,"Звено",ring,iron,Vector3(.128,.952+i*.031,0))
		link.rotation = Vector3(PI*.5,i%2*PI*.5,0)
	var meat := _mat(Color(.293,.121,.077),.84)
	for i in 8:
		var p := Vector3(.421,1.664,-.57+i*.160)
		var strip := _mesh(root,"Вяленая_зайчатина",_block(Vector3(.027,.211+i%3*.019,.081+(i%2)*.013),.011,Color.WHITE,i,.009),meat,p)
		strip.rotation = Vector3(.14*sin(float(i)),i*.45,.12)
	_candle(root,Vector3(.30,1.433,-.644),.059,.15)
	return root

func _smoke() -> Node3D:
	var root := _group(null,"Дым")
	var effect := GPUParticles3D.new()
	effect.name = "Дым_над_трубой"
	effect.amount = 43
	effect.lifetime = 7.5
	effect.preprocess = 5.0
	effect.visibility_aabb = AABB(Vector3(-6,-1,-5),Vector3(13,9,12))
	effect.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var drift := ParticleProcessMaterial.new()
	drift.direction = Vector3(.70,1.0,.28)
	drift.spread = 12.0
	drift.gravity = Vector3(.083,.013,.011)
	drift.initial_velocity_min = .37
	drift.initial_velocity_max = .53
	drift.scale_min = .72
	drift.scale_max = 1.02
	var spread := Curve.new()
	spread.add_point(Vector2(0.0,.37))
	spread.add_point(Vector2(.42,.69))
	spread.add_point(Vector2(1.0,1.0))
	var growth := CurveTexture.new()
	growth.curve = spread
	drift.scale_curve = growth
	var fade := Gradient.new()
	fade.offsets = PackedFloat32Array([0.0,.07,.57,1.0])
	fade.colors = PackedColorArray([Color(1,1,1,0),Color(1,1,1,.48),Color(1,1,1,.29),Color(1,1,1,0)])
	var texture := GradientTexture1D.new()
	texture.gradient = fade
	drift.color_ramp = texture
	effect.process_material = drift
	var quad := QuadMesh.new()
	quad.size = Vector2(1.32,1.57)
	quad.material = _shader(SMOKE)
	effect.draw_pass_1 = quad
	root.add_child(effect)
	return root

func _porch() -> Node3D:
	var root := _group(null,"У_порога")
	var reed := _fabric(Color(.36,.288,.192),Color(.225,.175,.109),.72)
	var mat := _mesh(root,"Плетёный_коврик",_cloth(Vector2(.81,.47),.013,.31),reed,Vector3(1.55,.062,2.75))
	mat.rotation.y = .023
	var bark := _mat(Color(.275,.201,.132),.95)
	var stump_profile := [Vector2(.35,0),Vector2(.34,.045),Vector2(.292,.082),Vector2(.264,.211),Vector2(.252,.362),Vector2(.256,.435),Vector2(0,.442)]
	_mesh(root,"Чурбан_для_дров",_lathe(stump_profile,21,0,2.6),bark,Vector3(4.345,.006,4.129))
	var top := _lathe([Vector2(0,0),Vector2(.251,0),Vector2(.241,.014),Vector2(0,.019)],24)
	_mesh(root,"Срез_чурбана",top,board,Vector3(4.345,.449,4.129))
	for i in 5:
		var at := Vector3(3.70+.14*i,.025+rng.randf()*.034,4.21+(i%2)*.20)
		var chip := _mesh(root,"Щепа_у_чурбана",_block(Vector3(.16,.029,.068),.008,Color.WHITE,i,.003),board,at)
		chip.rotation.y = rng.randf_range(-1.2,1.2)
	return root

func _curtains() -> Node3D:
	var root := _group(null,"Шерстяная_занавеска")
	var wool := _shader(WOOL)
	var repaired := wool.duplicate() as ShaderMaterial
	repaired.set_shader_parameter("mend",1.0)
	var cord := _mat(Color(.42,.321,.20),.98)
	_curtain_panel(root,"Левая_портьера",Vector3(0,1.832,.046),Vector3.BACK,.681,true,wool,cord)
	_curtain_panel(root,"Правая_портьера",Vector3(0,1.832,2.269),Vector3.FORWARD,.513,true,repaired,cord)
	_curtain_panel(root,"Задняя_портьера",Vector3(.067,1.832,0),Vector3.RIGHT,1.455,false,wool,cord)
	return root

func _curtain_panel(root: Node3D, label: String, start: Vector3, axis: Vector3, span: float, gathered: bool, fabric: Material, cord: Material) -> void:
	var panel := _group(root,label)
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pleats := PackedVector3Array()
	var right := axis.cross(Vector3.UP)
	for row in 29:
		var v := row/28.0
		var tie_pressure := exp(-pow((v-.53)/.134,2.0)) if gathered else 0.0
		var width := span*(1.0 - tie_pressure*.55)
		for col in 41:
			var u := col/40.0
			var hanging := u*width+.039*v*sin(u*6.9+v*3.7)
			var amplitude := .030+.034*v
			var fold := sin(u*(31.0 if gathered else 56.0)+v*2.7+.31*sin(u*20.0))
			var depth := amplitude*fold*(1.0-.32*tie_pressure) + .024*sin(u*7.0-v*4.4)*v
			var lower_hem := pow(v,9.0)*(.049*sin(u*21.0)+.032*sin(u*33.0+1.7))
			pleats.append(start+axis*hanging+right*depth - Vector3.UP*(1.694*v+lower_hem))
	for row in 28:
		for col in 40:
			var corner := row*41+col
			for i in [corner,corner+1,corner+41,corner+1,corner+42,corner+41]:
				var u := (int(i)%41)/40.0
				var v := floorf(float(i)/41.0)/28.0
				var shade := .44+.25*sin(u*41.0)*sin(v*7.5+u*6.0)
				_point(surface,pleats[i],Color(shade,shade,shade),Vector2(u,v))
	surface.index()
	surface.generate_normals()
	_mesh(panel,"Складки_и_подол",surface.commit(),fabric,Vector3.ZERO)
	var ring := TorusMesh.new()
	ring.inner_radius = .027
	ring.outer_radius = .034
	ring.rings = 14
	ring.ring_segments = 7
	var count := 5 if gathered else 9
	for i in count:
		var u := (i+.35)/(count-.26)
		var ring_pos := pleats[roundi(u*40.0)]
		var attachment := _mesh(panel,"Кольцо",ring,iron,ring_pos+Vector3.UP*.039)
		attachment.quaternion = Quaternion(Vector3.UP,axis)
		var loop := PackedVector3Array([ring_pos+Vector3.UP*.022,ring_pos+right*.012,ring_pos+right*.004-Vector3.UP*.032])
		_mesh(panel,"Пришитая_петля",_tube(loop,.008,6),cord,Vector3.ZERO)
	if gathered:
		var knot := start+axis*span*.28-Vector3.UP*.90
		for i in 2:
			var turn := PackedVector3Array()
			for j in 29:
				var angle := j*TAU/28.0
				turn.append(knot+axis*cos(angle)*span*.258+right*sin(angle)*.056+Vector3.UP*(.012*i))
			_mesh(panel,"Шнур",_tube(turn,.006,7),cord,Vector3.ZERO)
		var ends := PackedVector3Array([knot+right*.055,knot+right*.066+axis*.027-Vector3.UP*.061,knot+right*.055+axis*.014-Vector3.UP*.157])
		_mesh(panel,"Конец_шнура",_tube(ends,.006,7),cord,Vector3.ZERO)

func _roof() -> Node3D:
	var root := _group(null,"Деревянная_кровля")
	var material := _shader(ROOF)
	material.set_shader_parameter("shake_wood",ROUGH_GRAIN)
	material.set_shader_parameter("shake_normal",ROUGH_NORMAL)
	var age := RandomNumberGenerator.new()
	age.seed = 1726
	for side in [-1.0,1.0]:
		var surface := SurfaceTool.new()
		surface.begin(Mesh.PRIMITIVE_TRIANGLES)
		for course in 21:
			var x := -5.05
			while x < 5.02:
				var width := age.randf_range(.153,.322)
				if is_equal_approx(x,-5.05):
					width *= .46+float(course%5)*.11
				var end := minf(x+width,5.04)
				if end-x < .046:
					break
				var bottom := course*.222+age.randf_range(-.024,.026)
				var upper := minf(bottom+age.randf_range(.306,.373),4.67)
				var near_break: bool = side > 0.0 and ((course == 2 and absf(x-2.50)<.18) or (course == 1 and absf(x-2.84)<.14) or (course == 0 and absf(x+.36)<.12))
				var nick := age.randf_range(.061,.112) if near_break else age.randf_range(-.012,.015)
				var lift := age.randf_range(.046,.068)+(.021 if near_break else 0.0)
				var shade := age.randf_range(.30,.87) if not near_break else .94
				_shake_strip(surface,side,Vector2(x+.005,end-.005),Vector2(bottom,upper),nick,lift,shade,age.randf())
				x = end
		surface.generate_normals()
		surface.generate_tangents()
		var label := "Дранка_южного_ската" if side > 0.0 else "Дранка_северного_ската"
		var slope := _mesh(root,label,surface.commit(),material,Vector3(0,3.337143,side*2.05))
		slope.rotation.x = side*atan2(.47709185,.87885344)
	var trim := _aged_board(Color(.76,.63,.50))
	for side in [-1.0,1.0]:
		var eaves := Vector3(0,2.211,side*4.090)
		_hewn_member(root,"Карнизная_доска",eaves+Vector3.LEFT*5.01,eaves+Vector3.RIGHT*5.01,Vector2(.154,.073),trim)
		for gable in [-1.0,1.0]:
			var lip := Vector3(gable*4.994,2.238,side*4.154)
			var ridge := Vector3(gable*4.994,4.532,side*.045)
			_hewn_member(root,"Ветровая_доска",lip,ridge,Vector2(.142,.079),trim)
		var caps := _group(root,"Коньковая_доска",Vector3(0,4.516,side*.111))
		caps.rotation.x = side*.48
		for i in 4:
			var at := Vector3(-3.775+i*2.51,age.randf_range(-.004,.006),0.0)
			_mesh(caps,"Накладка_конька",_block(Vector3(2.505,.048,.276),.014,Color(.71,.69,.63),float(i),.004),trim,at)
	return root

func _shake_strip(surface: SurfaceTool, side: float, ends: Vector2, span: Vector2, nick: float, lift: float, shade: float, seed: float) -> void:
	var left := ends.x
	var right := ends.y
	var middle := lerpf(left,right,.35+seed*.31)
	var head := side*(2.348-span.y)
	var tail := side*(2.348-span.x)
	var points := PackedVector3Array([
		Vector3(left,.061+lift,tail),Vector3(middle,.057+lift,tail-side*nick),Vector3(right,.059+lift,tail-side*nick*.40),
		Vector3(left+.007,.076,head),Vector3(middle,.079,head),Vector3(right-.003,.074,head),
		Vector3(left,.068,tail),Vector3(middle,.071,tail-side*nick),Vector3(right,.068,tail-side*nick*.40),
	])
	var order := [0,3,1,1,3,4,1,4,2,2,4,5,0,1,6,1,7,6,1,2,7,2,8,7]
	for triangle in range(0,order.size(),3):
		for j in ([0,1,2] if side > 0.0 else [0,2,1]):
			var index: int = order[triangle+j]
			var p := points[index]
			var uv := Vector2(p.x*.94+seed,(p.z+side*p.y)*1.17+seed*.71)
			_point(surface,p,Color(shade,(.37 if nick > .04 else .88) if index<6 else .58,1.0 if index<6 else .25),uv)

func _aged_board(tint: Color) -> ShaderMaterial:
	var finish := _shader(PLANKS)
	finish.set_shader_parameter("grain",ROUGH_GRAIN)
	finish.set_shader_parameter("grain_normal",ROUGH_NORMAL)
	finish.set_shader_parameter("tint",tint)
	return finish

func _hewn_member(root: Node3D, label: String, from: Vector3, to: Vector3, section: Vector2, material: Material) -> Node3D:
	var axis := to-from
	var shape := _block(Vector3(axis.length(),section.x,section.y),.014,Color(.86,.82,.76),from.x+to.z,.005)
	var part := _mesh(root,label,shape,material,(from+to)*.5)
	part.quaternion = Quaternion(Vector3.RIGHT,axis.normalized())
	return part

func _rafters() -> Node3D:
	var root := _group(null,"Стропила_и_затяжки")
	var framing := _aged_board(Color(.78,.62,.46))
	var pegged := _mat(Color(.244,.177,.115),.96)
	for i in 7:
		var x := -4.19+i*1.390
		for side in [-1.0,1.0]:
			var from := Vector3(x,2.415,side*3.58)
			var to := Vector3(x,4.275,0)
			_hewn_member(root,"Тёсаное_стропило",from,to,Vector2(.148,.125),framing)
		if i%2 == 1:
			var collar := Vector3(x,2.375,0)
			_hewn_member(root,"Затяжка",collar+Vector3.FORWARD*3.51,collar+Vector3.BACK*3.51,Vector2(.169,.192),framing)
			for side in [-1.0,1.0]:
				var peg := Vector3(x-.106,2.40,side*3.37)
				var shaft := PackedVector3Array([peg-Vector3.RIGHT*.007,peg+Vector3.RIGHT*.185])
				_mesh(root,"Деревянный_нагель",_tube(shaft,.016,8),pegged,Vector3.ZERO)
	for side in [-1.0,1.0]:
		var purlin := Vector3(0,3.312,side*1.82)
		_hewn_member(root,"Продольный_прогон",purlin+Vector3.LEFT*4.44,purlin+Vector3.RIGHT*4.44,Vector2(.117,.130),framing)
	var apex := Vector3(0,4.238,0)
	_hewn_member(root,"Коньковый_прогон",apex+Vector3.LEFT*4.48,apex+Vector3.RIGHT*4.48,Vector2(.143,.158),framing)
	return root

func _joinery() -> Node3D:
	var root := _group(null,"Оконные_и_дверные_притолоки")
	var weather := _shader(preload("res://textures/weathered_boards.gdshader"))
	weather.set_shader_parameter("plank",preload("res://textures/weathered/weathered_planks_d.res"))
	weather.set_shader_parameter("plank_normal",preload("res://textures/weathered/weathered_planks_n.res"))
	for window in [
		[Vector3(-1.8,.835,3.48), Vector3(1.31,.259,.23), Vector3(1.36,.052,.333),.968],
		[Vector3(3.30,.937,3.48), Vector3(.72,.228,.23), Vector3(.77,.052,.325),1.056],
		[Vector3(2.60,.986,-3.48), Vector3(.91,.233,.24), Vector3(.98,.049,.330),1.113],
		[Vector3(4.48,.974,-1.25), Vector3(.24,.25,.82), Vector3(.32,.050,.860),1.116],
	]:
		var center: Vector3 = window[0]
		var size: Vector3 = window[1]
		var top_size: Vector3 = window[2]
		_mesh(root,"Оконный_косяк",_block(size,.018,Color(.69,.65,.59),center.x,.004),board,center)
		_mesh(root,"Полка_подоконника",_block(top_size,.014,Color(.79,.71,.63),center.z,.003),board,
			Vector3(center.x,window[3],center.z))
	for trim in [
		[Vector3(-1.80,1.819,3.48),Vector3(1.35,.146,.267)],
		[Vector3(3.30,1.756,3.48),Vector3(.76,.248,.262)],
		[Vector3(2.60,1.817,-3.48),Vector3(.98,.131,.264)],
		[Vector3(4.48,1.773,-1.25),Vector3(.249,.222,.862)],
		[Vector3(1.40,1.997,3.49),Vector3(1.19,.144,.264)],
	]:
		var at: Vector3 = trim[0]
		var size: Vector3 = trim[1]
		_mesh(root,"Притолока",_block(size,.019,Color.WHITE,at.x,.007),weather,at)
	return root

func _river_rock() -> Node3D:
	var root := _group(null,"Камень_у_ручья")
	var lichen := _mat(Color(.28,.334,.214),.96)
	_stone(root,Vector3(.79,.42,.61),Vector3(0,.13,0),.56,4.68)
	var crust := _block(Vector3(.35,.060,.31),.026,Color(.90,.84,.72),2.64,.018)
	_mesh(root,"Мох",crust,lichen,Vector3(.11,.333,.067)).rotation.y = -.624
	return root

func _table_frame(root: Node3D) -> void:
	var dark := board.duplicate() as ShaderMaterial
	dark.set_shader_parameter("wood_color",Color(.315,.239,.164))
	dark.set_shader_parameter("long_axis",2)
	var top := board.duplicate() as ShaderMaterial
	top.set_shader_parameter("wood_color",Color(.47,.358,.243))
	for i in 4:
		var plank := _mesh(root,"Доска_столешницы",_block(Vector3(2.14,.088,.244),.011,Color.WHITE,1.4+i*.34,.003),
			top,Vector3(0,.736,-.373+i*.249))
		plank.set_instance_shader_parameter("board_shift",-.21+i*.133)
	for x in [-.963,.963]:
		for z in [-.389,.389]:
			var leg := _block(Vector3(.119,.684,.117),.013,Color.WHITE,x+z*2.1,.007)
			_mesh(root,"Ножка",leg,dark,Vector3(x,.354,z))

func _bench_frame() -> Node3D:
	var root := _group(null,"Скамья_из_досок")
	var trim := board.duplicate() as ShaderMaterial
	trim.set_shader_parameter("wood_color",Color(.419,.325,.225))
	var legs := board.duplicate() as ShaderMaterial
	legs.set_shader_parameter("wood_color",Color(.295,.222,.153))
	legs.set_shader_parameter("long_axis",2)
	for side in [-1.0,1.0]:
		var plank := _block(Vector3(1.895,.062,.154),.012,Color.WHITE,side*.82,.004)
		_mesh(root,"Доска_сиденья",plank,trim,Vector3(0,.397,side*.079))
		for end in [-1.0,1.0]:
			var leg := _block(Vector3(.112,.365,.097),.013,Color.WHITE,end+side*1.4,.006)
			_mesh(root,"Ножка",leg,legs,Vector3(end*.847,.190,side*.072))
	return root
