extends Node3D

const ДАННЫЕ := preload("res://scripts/layout.gd").DATA
const УЧАСТОК: Dictionary = ДАННЫЕ.site
const ЛЮК: Array = ДАННЫЕ.room.hatch

@onready var огонь: OmniLight3D = $"Сруб/Очаг/Огонь"
@onready var люк: Node3D = $"Сруб/Люк"
@onready var петля: Node3D = $"Сруб/Люк/Петля"
var открыт := false
var движение_люка: Tween

var м := {}

func _ready() -> void:
	_материалы_участка()
	_рельеф()
	_тропа("Тропа_к_ручью", УЧАСТОК.trail, .37)
	_тропа("Спуск_к_коновязи", УЧАСТОК.access, .23)
	preload("res://scripts/forest.gd").new().populate(self, _высота)
	_у_ручья()
	var игрок := CharacterBody3D.new()
	игрок.name = "Игрок"
	игрок.set_script(load("res://scripts/player.gd"))
	add_child(игрок)
	if "--inside" in OS.get_cmdline_user_args():
		игрок.position = Vector3(2.15, .07, 2.62)
		игрок.rotation.y = deg_to_rad(39)
		игрок.камера.rotation.x = deg_to_rad(-10)
	else:
		игрок.position = Vector3(3.60, .055, 8.20)
		игрок.rotation.y = deg_to_rad(25)

func _process(_delta: float) -> void:
	var t := Time.get_ticks_msec() * .001
	огонь.light_energy = 2.28 + .12 * sin(t * 5.1) + .07 * sin(t * 9.4)

func interact(действие: String, игрок: CharacterBody3D) -> void:
	match действие:
		"hatch":
			var от_центра := игрок.global_position - люк.global_position
			var над_проёмом := absf(от_центра.x) < ЛЮК[2] / 2 and absf(от_центра.z) < ЛЮК[3] / 2
			if открыт and над_проёмом and от_центра.y > -.60:
				return
			_двинуть_люк(not открыт)
		"ladder":
			if not открыт:
				_двинуть_люк(true)
			var наверх := игрок.global_position.y < -1.0
			var точка := люк.global_position + (Vector3(.92,.06,.14) if наверх else Vector3(.65,-2.055,0))
			игрок.global_position = точка
			игрок.velocity = Vector3.ZERO
			игрок.reset_physics_interpolation()

func _двинуть_люк(открыть: bool) -> void:
	открыт = открыть
	if движение_люка != null:
		движение_люка.kill()
	движение_люка = create_tween()
	движение_люка.tween_property(петля, "rotation:z", deg_to_rad(103) if открыт else 0.0, .43) 		.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)

# Рельеф от поляны (0) до сухого берега (−2,00) и воды (−2,65 м).
func _линия_берега(x: float, берег: Array) -> float:
	for i in range(1, берег.size()):
		var a: Array = берег[i - 1]
		var b: Array = берег[i]
		if x <= b[0]:
			return lerpf(a[1], b[1], clampf(inverse_lerp(a[0], b[0], x), 0, 1))
	return берег.back()[1]

func _высота(x: float, z: float) -> float:
	var ближний := _линия_берега(x, УЧАСТОК.lower)
	var дальний := _линия_берега(x, УЧАСТОК.upper)
	if z >= -5.3:
		return 0.0
	if z >= -13.2:
		return lerpf(-2, 0, smoothstep(-13.2, -5.3, z))
	if z >= ближний:
		return lerpf(-2.70, -2.0, smoothstep(ближний, ближний + 1.35, z))
	if z <= дальний:
		return lerpf(-1.35, -2.70, smoothstep(дальний - 4.0, дальний, z))
	return -3.0

func _точка(p: Array, подъём := .0) -> Vector3:
	return Vector3(p[0], _высота(p[0], p[1]) + подъём, p[1])

func _мат(цвет: Color, шероховатость := .9) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = цвет
	mat.roughness = шероховатость
	return mat

func _материалы_участка() -> void:
	var soil := ShaderMaterial.new()
	soil.shader = preload("res://textures/forest_soil.gdshader")
	м.земля = soil
	м.кора = _мат(Color(.31,.21,.15))
	м.камень = _мат(Color(.45,.43,.36))
	м.вода = _мат(Color(.24,.41,.43,.84),.12)
	м.вода.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	м.шкура = _мат(Color(.48,.37,.26))

func _цвет_грунта(x: float, z: float, y: float) -> Color:
	var влажность := smoothstep(-2.9,-1.1,y)
	var основной := Color(.35,.375,.35).lerp(Color(.56,.55,.48),влажность)
	var просвет := .91+.072*sin(x*.82+z*1.37)+.053*cos(z*.77-x*.41)
	return основной*просвет

func _вершина_грунта(mesh: SurfaceTool, x: float, z: float) -> void:
	var y := _высота(x,z)
	mesh.set_color(_цвет_грунта(x,z,y))
	mesh.add_vertex(Vector3(x,y,z))

func _рельеф() -> void:
	var поверхность := SurfaceTool.new()
	поверхность.begin(Mesh.PRIMITIVE_TRIANGLES)
	for x in range(-47,47):
		for z in range(-47,47):
			# Вырез под погребом закрыт половицами с настоящим проёмом под люк.
			if x >= -4 and x < 0 and z >= -1 and z < 3:
				continue
			for v in [Vector2(x,z),Vector2(x+1,z),Vector2(x,z+1),Vector2(x+1,z),Vector2(x+1,z+1),Vector2(x,z+1)]:
				_вершина_грунта(поверхность,v.x,v.y)
	поверхность.index()
	поверхность.generate_normals()
	var земля := _сетка("Рельеф",поверхность,м.земля)
	земля.create_trimesh_collision()
	var вода := SurfaceTool.new()
	вода.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in range(1, УЧАСТОК.upper.size()):
		var a: Array = УЧАСТОК.upper[i-1]
		var b: Array = УЧАСТОК.upper[i]
		var c: Array = УЧАСТОК.lower[i-1]
		var d: Array = УЧАСТОК.lower[i]
		for p in [a,b,c,b,d,c]:
			вода.add_vertex(Vector3(p[0],-2.65,p[1]))
	вода.generate_normals()
	_сетка("Ручей",вода,м.вода)

func _сетка(имя: String, поверхность: SurfaceTool, мат: Material) -> MeshInstance3D:
	var узел := MeshInstance3D.new()
	узел.name = имя
	узел.mesh = поверхность.commit()
	узел.material_override = мат
	add_child(узел)
	return узел

func _тропа(имя: String, точки: Array, полуширина: float) -> void:
	var поверхность := SurfaceTool.new()
	поверхность.begin(Mesh.PRIMITIVE_TRIANGLES)
	var центры := PackedVector2Array()
	for i in range(1,точки.size()):
		var a := Vector2(точки[i-1][0],точки[i-1][1])
		var b := Vector2(точки[i][0],точки[i][1])
		var steps := maxi(1,ceili(a.distance_to(b)/.30))
		for j in steps:
			центры.append(a.lerp(b,float(j)/steps))
	центры.append(Vector2(точки.back()[0],точки.back()[1]))
	var вершины: Array[Vector3] = []
	var цвета := PackedColorArray()
	var ширины := [-1.0,-.64,.64,1.0]
	for i in центры.size():
		var p := центры[i]
		var ход := (центры[mini(i+1,центры.size()-1)]-центры[maxi(i-1,0)]).normalized()
		var сбоку := Vector2(ход.y,-ход.x)*полуширина*(.95+.13*sin(i*.49)+.08*cos(i*.83))
		for j in ширины.size():
			var q: Vector2 = p+сбоку*ширины[j]
			var высота := _высота(q.x,q.y)
			var цвет := _цвет_грунта(q.x,q.y,высота)
			if j==1 or j==2:
				цвет = цвет.lerp(Color(.69,.62,.49),.59)
			цвета.append(цвет)
			вершины.append(Vector3(q.x,высота+.038,q.y))
	for i in range(0,вершины.size()-4,4):
		for j in range(i,i+3):
			for k in [j,j+1,j+4,j+1,j+5,j+4]:
				поверхность.set_color(цвета[k])
				поверхность.add_vertex(вершины[k])
	поверхность.generate_normals()
	_сетка(имя,поверхность,м.земля)

func _ствол(p: Vector3, радиус: float, высота: float, мат: Material, крона := false) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var форма := CylinderMesh.new()
	форма.bottom_radius = радиус
	форма.top_radius = 0 if крона else радиус*.68
	форма.height = высота
	форма.radial_segments = 9
	форма.rings = 0
	mi.mesh = форма
	mi.material_override = мат
	mi.position = p
	add_child(mi)
	return mi

func _жердь(откуда: Vector3, куда: Vector3, радиус: float) -> MeshInstance3D:
	var вектор := куда - откуда
	var узел := _ствол((откуда+куда)/2, радиус, вектор.length(), м.кора)
	узел.quaternion = Quaternion(Vector3.UP, вектор.normalized())
	return узел

func _у_ручья() -> void:
	for координаты in [[-3.0,-15.95],[-3.28,-16.54],[-2.91,-17.24],[-2.63,-17.85],[-.7,10.45],[5.65,9.0],[-4.15,-6.2],[11.6,-6.7]]:
		var mi := MeshInstance3D.new()
		var форма := SphereMesh.new()
		форма.radius = .31
		форма.height = .36
		форма.radial_segments = 7
		форма.rings = 4
		mi.mesh = форма
		mi.material_override = м.камень
		mi.position = _точка(координаты,.11)
		mi.scale.z = .74
		add_child(mi)
	var p := УЧАСТОК.rail
	_жердь(_точка(p[0],1.15),_точка(p[1],1.15),.064).name = "Коновязь"
	var сушилка := УЧАСТОК.rack
	for опора in сушилка:
		_жердь(_точка(опора),_точка(опора,1.43),.051)
	for y in [1.02,1.38]:
		_жердь(_точка(сушилка[0],y),_точка(сушилка[1],y),.037)
	for i in 2:
		var mi := MeshInstance3D.new()
		var panel := BoxMesh.new()
		panel.size = Vector3(.36,.51,.052)
		mi.mesh = panel
		mi.material_override = м.шкура
		mi.position = _точка([-2.24+i*.70,-5.20],1.12)
		mi.rotation.z = .12-i*.23
		add_child(mi)
