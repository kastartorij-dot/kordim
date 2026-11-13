extends Node3D
# Черновая Нора из простых фигур: сруб по картинкам nora-exterior / nora-plan и записи 24,
# лес, ручей, огонь в очаге. Потом фигуры заменятся моделями из Blender, раскладка останется.
#
# Оси: X — вдоль длинной стены (9 м), Z — вглубь (7 м), фасад с дверью смотрит на +Z.
# Левая стена (очаг) — x = -4.5, правая (угол Арна) — x = +4.5, задняя — z = -3.5.

const ДЛ := 9.0       # длина сруба
const ГЛ := 7.0       # глубина
const В := 2.4        # высота стен
const ПОДЪЁМ := 1.9   # конёк над стенами
const R := 0.13       # радиус бревна

var м := {}  # материалы
var огонь: OmniLight3D

func _ready() -> void:
	randomize()
	seed(1026)
	_материалы()
	_земля()
	_сруб()
	_внутри()
	_снаружи()
	_лес()
	var игрок := CharacterBody3D.new()
	игрок.set_script(load("res://scripts/player.gd"))
	add_child(игрок)
	if "--inside" in OS.get_cmdline_user_args():
		игрок.position = Vector3(2.5, 0.05, 2.2)
		игрок.rotation.y = deg_to_rad(40)
	else:
		игрок.position = Vector3(-1.5, 0.05, 13)
		игрок.rotation.y = deg_to_rad(-8)

func _process(_dt: float) -> void:
	огонь.light_energy = 2.2 + 0.35 * sin(Time.get_ticks_msec() * 0.013) + randf() * 0.25

# ---------- материалы ----------

func _мат(цвет: Color, шум := true, масштаб := Vector3(1, 1, 1), шерох := 0.9) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = цвет
	mat.roughness = шерох
	if шум:
		var n := NoiseTexture2D.new()
		n.seamless = true
		n.noise = FastNoiseLite.new()
		n.noise.frequency = 0.03
		var grad := Gradient.new()
		grad.set_color(0, Color(0.55, 0.55, 0.55))
		grad.set_color(1, Color(1.15, 1.15, 1.15))
		n.color_ramp = grad
		mat.albedo_texture = n
		mat.uv1_triplanar = true
		mat.uv1_scale = масштаб
	return mat

func _материалы() -> void:
	м.бревно = _мат(Color(0.33, 0.27, 0.21), true, Vector3(0.6, 3, 0.6))
	м.доска = _мат(Color(0.36, 0.25, 0.15), true, Vector3(0.4, 2, 0.4))
	м.тёмное = _мат(Color(0.22, 0.15, 0.09))
	м.мох = _мат(Color(0.25, 0.3, 0.14), true, Vector3(0.3, 0.3, 0.3))
	м.камень = _мат(Color(0.42, 0.4, 0.37), true, Vector3(1.2, 1.2, 1.2))
	м.земля = _мат(Color(0.2, 0.19, 0.11), true, Vector3(0.08, 0.08, 0.08))
	м.кора = _мат(Color(0.3, 0.18, 0.12), true, Vector3(1, 4, 1))
	м.хвоя = _мат(Color(0.11, 0.2, 0.12), true, Vector3(0.5, 0.5, 0.5))
	м.шерсть = _мат(Color(0.55, 0.47, 0.36), true, Vector3(2, 2, 2))
	м.мех = _мат(Color(0.45, 0.33, 0.22), true, Vector3(3, 3, 3))
	м.железо = _мат(Color(0.15, 0.15, 0.16), false, Vector3.ONE, 0.5)
	м.стекло = _мат(Color(0.5, 0.65, 0.55, 0.6), false, Vector3.ONE, 0.2)
	м.стекло.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	м.вода = _мат(Color(0.12, 0.2, 0.22, 0.85), false, Vector3.ONE, 0.05)
	м.вода.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	м.мясо = _мат(Color(0.35, 0.12, 0.08))
	м.пламя = StandardMaterial3D.new()
	м.пламя.albedo_color = Color(1, 0.5, 0.15)
	м.пламя.emission_enabled = true
	м.пламя.emission = Color(1, 0.45, 0.1)
	м.пламя.emission_energy_multiplier = 4.0

# ---------- помощники ----------

func _ящик(размер: Vector3, где: Vector3, мат: Material, твёрдый := true, подпись := "", поворот := Vector3.ZERO) -> Node3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = размер
	mi.mesh = bm
	mi.material_override = мат
	return _поставить(mi, BoxShape3D.new() if твёрдый or подпись != "" else null, размер, где, поворот, подпись)

func _цилиндр(r: float, h: float, где: Vector3, мат: Material, поворот := Vector3.ZERO, твёрдый := true, подпись := "", r_верх := -1.0) -> Node3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.bottom_radius = r
	cm.top_radius = r if r_верх < 0 else r_верх
	cm.height = h
	cm.radial_segments = 10
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = мат
	var форма: Shape3D = null
	if твёрдый or подпись != "":
		форма = CylinderShape3D.new()
		форма.radius = max(r, cm.top_radius)
		форма.height = h
	return _поставить(mi, форма, Vector3.ZERO, где, поворот, подпись)

func _поставить(mi: MeshInstance3D, форма: Shape3D, размер: Vector3, где: Vector3, поворот: Vector3, подпись: String) -> Node3D:
	if форма == null:
		mi.position = где
		mi.rotation = поворот
		add_child(mi)
		return mi
	if форма is BoxShape3D: форма.size = размер
	var тело := StaticBody3D.new()
	тело.position = где
	тело.rotation = поворот
	var cs := CollisionShape3D.new()
	cs.shape = форма
	тело.add_child(cs)
	тело.add_child(mi)
	if подпись != "": тело.set_meta("label", подпись)
	add_child(тело)
	return тело

# ---------- земля ----------

func _земля() -> void:
	_ящик(Vector3(160, 1, 160), Vector3(0, -0.5, 0), м.земля)
	# ручей за домом, вниз по склону — пока ровной полосой
	var вода := _ящик(Vector3(160, 0.05, 2.6), Vector3(0, 0.02, -17), м.вода, false)
	вода.name = "Ручей"
	for i in 30:
		_ящик(Vector3(randf_range(0.3, 0.8), 0.25, randf_range(0.3, 0.6)),
			Vector3(randf_range(-30, 30), 0.08, -17 + randf_range(-1.6, 1.6)), м.камень, false, "",
			Vector3(0, randf() * TAU, 0))

# ---------- сруб ----------

# Стена из брёвен вдоль оси X (вдоль_x = true) или Z, с проёмами [от, до, низ, верх].
func _стена(вдоль_x: bool, коорд: float, от: float, до: float, сдвиг: float, проёмы: Array) -> void:
	var y := R + сдвиг
	while y < В:
		var куски := [[от, до]]
		for п in проёмы:
			if y + R > п[2] and y - R < п[3]:
				var новые := []
				for к in куски:
					if п[1] <= к[0] or п[0] >= к[1]: новые.append(к); continue
					if п[0] > к[0]: новые.append([к[0], п[0]])
					if п[1] < к[1]: новые.append([п[1], к[1]])
				куски = новые
		for к in куски:
			var длина: float = к[1] - к[0]
			if длина < 0.05: continue
			var центр: float = (к[0] + к[1]) / 2
			if вдоль_x:
				_цилиндр(R, длина, Vector3(центр, y, коорд), м.бревно, Vector3(0, 0, PI / 2))
			else:
				_цилиндр(R, длина, Vector3(коорд, y, центр), м.бревно, Vector3(PI / 2, 0, 0))
		y += 2 * R * 0.85

func _фронтон(x: float) -> void:
	# треугольник над боковой стеной — укорачивающиеся брёвна
	var y := В + R
	while y < В + ПОДЪЁМ - 0.15:
		var доля := 1.0 - (y - В) / ПОДЪЁМ
		_цилиндр(R, ГЛ * доля, Vector3(x, y, 0), м.бревно, Vector3(PI / 2, 0, 0))
		y += 2 * R * 0.85

func _сруб() -> void:
	var хв := 0.25  # концы брёвен торчат за угол
	var пол_x := ДЛ / 2
	var пол_z := ГЛ / 2
	# фасад: окно слева от двери, дверь правее середины, маленькое окно справа
	_стена(true, пол_z, -пол_x - хв, пол_x + хв, 0, [
		[-2.4, -1.2, 0.95, 1.75],
		[0.9, 1.9, -1, 1.95],
		[3.0, 3.6, 1.05, 1.65]])
	# задняя: окно над топчанами (как на плане)
	_стена(true, -пол_z, -пол_x - хв, пол_x + хв, 0, [[2.2, 3.0, 1.1, 1.75]])
	# боковые — со сдвигом на полбревна, как в срубе
	_стена(false, -пол_x, -пол_z - хв, пол_z + хв, R, [])
	_стена(false, пол_x, -пол_z - хв, пол_z + хв, R, [[-1.6, -0.9, 1.1, 1.7]])
	_фронтон(-пол_x)
	_фронтон(пол_x)
	# окна: рамы со стеклом-пузырём и ставни снаружи
	for о in [[-1.8, 1.2, 0.8, true], [3.3, 0.6, 0.6, true]]:
		_ящик(Vector3(о[1], о[2], 0.04), Vector3(о[0], 1.35, пол_z), м.стекло, false)
		_ящик(Vector3(0.45, о[2] + 0.1, 0.05), Vector3(о[0] - о[1] / 2 - 0.25, 1.35, пол_z + R + 0.05), м.доска, false)
		_ящик(Vector3(0.45, о[2] + 0.1, 0.05), Vector3(о[0] + о[1] / 2 + 0.25, 1.35, пол_z + R + 0.05), м.доска, false)
	_ящик(Vector3(0.8, 0.65, 0.04), Vector3(2.6, 1.42, -пол_z), м.стекло, false)
	_ящик(Vector3(0.04, 0.6, 0.7), Vector3(пол_x, 1.4, -1.25), м.стекло, false)
	# дверь — приоткрыта внутрь
	var дверь := _ящик(Vector3(1.0, 1.95, 0.07), Vector3(0, 0, 0), м.тёмное, true, "Дверь. Подходят к ней обходом, по камню и воде — следа не остаётся.")
	дверь.position = Vector3(0.9 + 0.5 * cos(deg_to_rad(70)), 0.98, пол_z - 0.5 * sin(deg_to_rad(70)))
	дверь.rotation.y = deg_to_rad(70)
	_ящик(Vector3(1.1, 0.12, 0.35), Vector3(1.4, 0.06, пол_z + 0.3), м.камень, false)  # порог-камень
	# пол
	_ящик(Vector3(ДЛ - 0.2, 0.02, ГЛ - 0.2), Vector3(0, 0.01, 0), м.доска, false)
	# крыша: два ската вдоль длинной стороны, дранка во мху
	var свес := 0.6
	var угол := atan(ПОДЪЁМ / пол_z)
	var дл_ската := (пол_z + свес) / cos(угол)
	for знак in [1, -1]:
		var zc: float = знак * (пол_z + свес) / 2
		var yc: float = В + ПОДЪЁМ - tan(угол) * abs(zc) + 0.15
		_ящик(Vector3(ДЛ + 1.0, 0.12, дл_ската), Vector3(0, yc, zc), м.мох, true, "", Vector3(знак * угол, 0, 0))
		_ящик(Vector3(ДЛ + 1.0, 0.03, дл_ската), Vector3(0, yc - 0.08, zc), м.доска, false, "", Vector3(знак * угол, 0, 0))

# ---------- внутри ----------

func _внутри() -> void:
	# Очаг у левой стены, ближе к фасаду; труба через крышу
	var oz := 0.9
	_ящик(Vector3(0.9, 0.35, 1.7), Vector3(-4.0, 0.17, oz), м.камень, true, "Очаг. Каменный, котелок на цепи. Труба выходит из левой части крыши.")
	_ящик(Vector3(0.35, 1.5, 1.7), Vector3(-4.25, 1.1, oz), м.камень, true)
	_ящик(Vector3(0.9, 1.15, 0.3), Vector3(-4.0, 0.92, oz - 0.7), м.камень, true)
	_ящик(Vector3(0.9, 1.15, 0.3), Vector3(-4.0, 0.92, oz + 0.7), м.камень, true)
	_ящик(Vector3(1.0, 0.4, 1.8), Vector3(-4.0, 1.7, oz), м.камень, false)
	_ящик(Vector3(0.7, 3.3, 0.8), Vector3(-4.15, 3.5, oz), м.камень, false)
	_ящик(Vector3(0.4, 0.15, 0.5), Vector3(-3.95, 0.42, oz), м.пламя, false)
	_цилиндр(0.02, 0.7, Vector3(-3.95, 1.15, oz), м.железо, Vector3.ZERO, false)
	_цилиндр(0.2, 0.28, Vector3(-3.95, 0.72, oz), м.железо, Vector3.ZERO, false, "Котелок на цепи.", 0.16)
	огонь = OmniLight3D.new()
	огонь.position = Vector3(-3.5, 0.8, oz)
	огонь.light_color = Color(1, 0.6, 0.3)
	огонь.omni_range = 9
	огонь.shadow_enabled = true
	add_child(огонь)
	# зайчатина вялится над очагом
	_цилиндр(0.015, 1.4, Vector3(-3.4, 1.95, oz), м.тёмное, Vector3(PI / 2, 0, 0), false)
	for i in 8:
		_ящик(Vector3(0.04, 0.3, 0.07), Vector3(-3.4, 1.78, oz - 0.6 + i * 0.17), м.мясо, false,
			"" if i else "Вяленая зайчатина. Сушёная, не солёная — соли тут не было, пока не привезли.")

	# Стол Никто — дальний левый угол, полки со склянками
	_ящик(Vector3(1.4, 0.06, 0.6), Vector3(-3.5, 0.8, -3.0), м.доска, true,
		"Стол Никто: склянки, мешочки с порошками, огарок. По меркам его алхимии — минимум.")
	for ox in [-0.6, 0.6]: _ящик(Vector3(0.06, 0.8, 0.5), Vector3(-3.5 + ox, 0.4, -3.0), м.доска, true)
	_ящик(Vector3(1.3, 0.04, 0.22), Vector3(-3.5, 1.55, -3.25), м.доска, false)
	for i in 6:
		_цилиндр(0.035, 0.12 + randf() * 0.08, Vector3(-4.0 + i * 0.2, 1.65, -3.25), м.стекло, Vector3.ZERO, false)
	for i in 3:
		_цилиндр(0.05, 0.1, Vector3(-3.8 + i * 0.25, 0.88, -2.95), м.шерсть, Vector3.ZERO, false)
	_цилиндр(0.025, 0.06, Vector3(-3.1, 0.86, -2.85), м.шерсть, Vector3.ZERO, false)

	# Стол с двумя лавками, люк под столом
	_ящик(Vector3(1.9, 0.08, 0.9), Vector3(0, 0.76, 0), м.доска, true, "Общий стол. Тяжёлый, на двух лавках.")
	for p in [Vector2(-0.8, -0.35), Vector2(0.8, -0.35), Vector2(-0.8, 0.35), Vector2(0.8, 0.35)]:
		_ящик(Vector3(0.08, 0.72, 0.08), Vector3(p.x, 0.36, p.y), м.доска, false)
	for z in [-0.8, 0.8]:
		_ящик(Vector3(1.7, 0.06, 0.28), Vector3(0, 0.45, z), м.доска, true)
		for x in [-0.7, 0.7]: _ящик(Vector3(0.06, 0.42, 0.24), Vector3(x, 0.21, z), м.доска, false)
	_ящик(Vector3(0.8, 0.02, 0.8), Vector3(0.1, 0.025, 0.05), м.тёмное, false)
	var кольцо := MeshInstance3D.new()
	кольцо.mesh = TorusMesh.new()
	кольцо.mesh.inner_radius = 0.05
	кольцо.mesh.outer_radius = 0.07
	кольцо.material_override = м.железо
	кольцо.position = Vector3(0.1, 0.04, 0.3)
	add_child(кольцо)
	_ящик(Vector3(0.8, 0.01, 0.8), Vector3(0.1, 0.005, 0.05), м.тёмное, true,
		"Люк с кованым кольцом. Погреб — запасы на несколько недель.")

	# Два топчана в дальнем правом углу и сундук между ними
	for bx in [1.4, 3.7]:
		_ящик(Vector3(0.85, 0.35, 1.9), Vector3(bx, 0.18, -2.45), м.доска, true,
			"Топчан Грейс. Над ним на крюке — арбалет." if bx < 2 else "Топчан Никто.")
		_ящик(Vector3(0.8, 0.08, 1.8), Vector3(bx, 0.39, -2.4), м.мех, false)
		_ящик(Vector3(0.6, 0.1, 0.3), Vector3(bx, 0.44, -3.15), м.шерсть, false)
	_ящик(Vector3(0.75, 0.5, 0.45), Vector3(2.55, 0.25, -3.0), м.тёмное, true,
		"Сундук. В нём ножи Никто — два кожаных рулона. Разворачивает после каждого возвращения, проверяет каждый клинок.")
	# арбалет на крюке над топчаном Грейс
	_ящик(Vector3(0.7, 0.05, 0.05), Vector3(1.4, 1.5, -3.33), м.тёмное, false)
	_ящик(Vector3(0.05, 0.05, 0.6), Vector3(1.4, 1.5, -3.3), м.тёмное, false, "", Vector3(PI / 2, 0, 0))

	# Угол Арна за шерстяной занавеской у правой стены
	_ящик(Vector3(0.75, 0.32, 1.8), Vector3(4.0, 0.16, 1.3), м.доска, true, "Угол Арна: узкий топчан и полка над ним.")
	_ящик(Vector3(0.7, 0.06, 1.7), Vector3(4.0, 0.35, 1.3), м.шерсть, false)
	_ящик(Vector3(0.3, 0.03, 1.0), Vector3(4.25, 1.5, 1.3), м.доска, false)
	_ящик(Vector3(0.03, 1.85, 1.9), Vector3(3.4, 1.0, 1.0), м.шерсть, true,
		"Шерстяная занавеска. За ней спит Арн. Дом — его.")
	_цилиндр(0.015, 2.4, Vector3(3.4, 1.95, 1.0), м.тёмное, Vector3(PI / 2, 0, 0), false)

# ---------- у дома ----------

func _снаружи() -> void:
	var z := ГЛ / 2 + 0.45
	# лавка из расколотого бревна и бочка — слева от входа, под окном
	_ящик(Vector3(1.6, 0.1, 0.32), Vector3(-1.8, 0.45, z), м.бревно, true, "Лавка из расколотого бревна.")
	for x in [-2.4, -1.2]: _ящик(Vector3(0.2, 0.42, 0.25), Vector3(x, 0.21, z), м.бревно, false)
	_цилиндр(0.32, 0.85, Vector3(-3.1, 0.43, z + 0.05), м.доска, Vector3.ZERO, true, "Старая бочка.", 0.28)
	# поленница у правой стены
	for ряд in 6:
		for i in 9:
			_цилиндр(0.07, 0.45, Vector3(ДЛ / 2 + 0.4 + (ряд % 2) * 0.03, 0.08 + ряд * 0.14, 0.2 + i * 0.16),
				м.кора, Vector3(0, 0, PI / 2), false)
	var п := _ящик(Vector3(0.5, 0.9, 1.5), Vector3(ДЛ / 2 + 0.4, 0.45, 0.85), м.кора, true,
		"Поленница. Ровно сложена — по ней Никто и понял, что хозяин живёт один и аккуратно.")
	п.get_child(1).visible = false

func _лес() -> void:
	var ствол := CylinderMesh.new()
	ствол.radial_segments = 8
	ствол.rings = 1
	var крона := CylinderMesh.new()
	крона.top_radius = 0.0
	крона.radial_segments = 8
	крона.rings = 1
	var деревья := []
	for i in 260:
		var p := Vector2(randf_range(-55, 55), randf_range(-55, 55))
		if abs(p.x) < 8.5 and abs(p.y) < 8: continue            # поляна у дома
		if abs(p.y + 17) < 2.2: continue                         # ручей
		if abs(p.x + 1.5) < 2.0 and p.y > 6 and p.y < 18: continue  # подход, откуда начинаем
		деревья.append(p)
	# две сосны у ручья с жердью-коновязью между ними (с тропы не видно)
	деревья.append(Vector2(7.0, -14.0))
	деревья.append(Vector2(9.6, -14.2))
	for p in деревья:
		var h := randf_range(14, 24)
		var r := h * 0.012 + 0.08
		_цилиндр(r, h, Vector3(p.x, h / 2, p.y), м.кора, Vector3.ZERO, true, "", r * 0.5)
		for k in 4:
			var ky := h * (0.45 + k * 0.14)
			var kh := h * 0.3 * (1.0 - k * 0.15)
			var mi := MeshInstance3D.new()
			mi.mesh = крона.duplicate()
			mi.mesh.bottom_radius = h * 0.12 * (1.0 - k * 0.2)
			mi.mesh.height = kh
			mi.material_override = м.хвоя
			mi.position = Vector3(p.x, ky, p.y)
			add_child(mi)
	_цилиндр(0.06, 2.6, Vector3(8.3, 1.2, -14.1), м.кора, Vector3(0, 0, PI / 2), true,
		"Жердь между двумя соснами — коновязь. От дома и с тропы её не видно. Сделал Арн сам.")
