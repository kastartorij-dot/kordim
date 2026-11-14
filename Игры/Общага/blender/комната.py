# Комната в общаге целиком — сборка из моделей мебель.py по схеме (схема/план.png) и рендер с точек съёмки.
# Запуск: $NORA/blender/bin/python blender/комната.py [ф1] [окно] [сверху] [--fast]
# Оси: X — от стены с дверью (x=0) к окну (x=4,6), Y — от стены со столом 1 (y=0) к стене с холодильником (y=3,2),
# Z — вверх, пол z=0. На схеме (вид сверху, окно справа) стена с холодильником — верхняя.
import bpy, math, os, sys, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from мебель import *   # noqa: F401,F403

L, W, H = 4.6, 3.2, 2.65
FAST = "--fast" in sys.argv

def place(root, x, y, rot=0.0, mirror_y=False):
    root.location = (x, y, 0)
    root.rotation_euler = (0, 0, math.radians(rot))
    if mirror_y: root.scale = (1, -1, 1)
    return root

def wall_box(name, x1, y1, z1, x2, y2, z2, mat):
    return box(name, x1, y1, z1, x2, y2, z2, mat, 0.0, None)

def wallpaper():
    m = flat_mat("обои", (0.86, 0.80, 0.62), 0.92)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 90; nz.inputs["Detail"].default_value = 6
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.35; bp.inputs["Distance"].default_value = 0.002
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def curtain(name, y1, y2, x, z1, z2, mat, folds=7, depth=0.06, seed=1, lean=0.0):
    """Штора с живыми складками: глубина и шаг складок неровные, вверху полотно собрано на кольцах
    плотнее, книзу складки расходятся и становятся глубже, низ чуть неровный; lean — насколько низ
    уведён в сторону (штору отодвинули). Висит в плоскости x, от y1 до y2."""
    rnd = random.Random(seed)
    harm = [(rnd.uniform(0.6, 1.4), rnd.uniform(0, 6.28)) for _ in range(3)]
    nu, nv = 90, 40
    bm = bmesh.new()
    grid = []
    width = y2 - y1
    for j in range(nv + 1):
        t = j / nv                       # 0 — низ, 1 — верх
        z = z1 + (z2 - z1) * t
        spread = 1.0 + 0.10 * (1 - t)    # книзу шире
        amp = depth * (0.55 + 0.6 * (1 - t))
        row = []
        for i in range(nu + 1):
            u = i / nu
            ph = u * folds * 2 * math.pi + sum(0.35 * math.sin(f * u * 6.28 + p0) for f, p0 in harm)
            d = amp * (0.5 + 0.5 * math.sin(ph)) ** 1.4 * (0.75 + 0.25 * math.sin(u * 9 + seed))
            y = y1 + width * (0.5 + (u - 0.5) * spread) + lean * (1 - t) ** 1.5
            zz = z
            if j == 0:                   # неровный подшив: где складка глубже — край выше
                zz = z + 0.025 * (0.5 + 0.5 * math.sin(ph)) + rnd.uniform(-0.004, 0.004)
            row.append(bm.verts.new((x - d, y, zz)))
        grid.append(row)
    for j in range(nv):
        for i in range(nu):
            bm.faces.new((grid[j][i], grid[j][i+1], grid[j+1][i+1], grid[j+1][i]))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    so = ob.modifiers.new("толщина", "SOLIDIFY"); so.thickness = 0.003
    sd = ob.modifiers.new("гладко", "SUBSURF"); sd.levels = 1; sd.render_levels = 2
    for p in ob.data.polygons: p.use_smooth = True
    # кольца на карнизе — по одному на каждый «гребень» складки вверху
    for k in range(folds * 2 + 1):
        yk = y1 + width * k / (folds * 2)
        r = cyl("кольцо", 0.014, 0, 0.004, x - 0.015, yk, mat_ring(), 16, None, "y")
        r.location = (x - 0.01, yk, z2 + 0.02)
    return ob

_ring = {}
def mat_ring():
    if "m" not in _ring: _ring["m"] = flat_mat("кольца", (0.85, 0.85, 0.83), 0.3, 0.6)
    return _ring["m"]

def fabric_mat(name, color, sheen=0.35):
    m = flat_mat(name, color, 0.8)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Tint"].default_value = (*[min(1, c * 2 + 0.15) for c in color], 1)
    nt = m.node_tree
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 400
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def puffer_mat(name, color):
    """Пуховик: горизонтальные стёжки-«трубы», блестящая синтетика."""
    m = flat_mat(name, color, 0.35)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wv = nt.nodes.new("ShaderNodeTexWave"); wv.wave_type = "BANDS"; wv.bands_direction = "Z"
    wv.wave_profile = "SIN"; wv.inputs["Scale"].default_value = 3.2
    nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.8
    nt.links.new(wv.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def loft(name, rings, mat, cap=True, smooth=2, parent=None):
    """Тело по ряду замкнутых сечений (у всех одинаковое число точек): рукава, куртки, обувь."""
    bm = bmesh.new()
    vr = [[bm.verts.new(p) for p in r] for r in rings]
    n = len(rings[0])
    for j in range(len(vr) - 1):
        for i in range(n):
            bm.faces.new((vr[j][i], vr[j][(i+1) % n], vr[j+1][(i+1) % n], vr[j+1][i]))
    if cap:
        bm.faces.new(vr[0][::-1]); bm.faces.new(vr[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    if smooth:
        sd = ob.modifiers.new("гладко", "SUBSURF"); sd.levels = 1; sd.render_levels = smooth
    for p in ob.data.polygons: p.use_smooth = True
    if parent: ob.parent = parent
    return ob

def ring_h(cx, cy, z, a, b, n=20, e=2.6):
    """Горизонтальное сечение-суперэллипс (полуоси a по x, b по y)."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s_ = math.cos(t), math.sin(t)
        pts.append((cx + a * math.copysign(abs(c) ** (2/e), c), cy + b * math.copysign(abs(s_) ** (2/e), s_), z))
    return pts

def куртка(name, x, y, mat, капюшон=False, длина=0.75, z_hook=1.6, seed=0, пуховик=False, мех=None):
    """Куртка на крючке у стены y=0. Сечения-суперэллипсы от собранного воротника к подолу; по сечениям
    идут вертикальные складки (к подолу глубже), у пуховика — горизонтальные «трубы» стёжки;
    рукава вдоль боков; капюшон сзади, по желанию с меховой опушкой."""
    rnd = random.Random(seed)
    zt = z_hook - 0.01
    prof = [(0.00, 0.035, 0.03), (0.03, 0.08, 0.05), (0.07, 0.16, 0.075), (0.12, 0.195, 0.095), (0.2, 0.2, 0.1),
            (0.3, 0.2, 0.105), (0.4, 0.205, 0.11), (0.5, 0.205, 0.11), (0.6, 0.21, 0.112), (0.7, 0.215, 0.113),
            (0.8, 0.218, 0.112), (0.9, 0.22, 0.108), (0.97, 0.22, 0.1), (1.0, 0.2, 0.085)]
    k = rnd.choice((7, 8, 9)); ph0 = rnd.uniform(0, 6.28)
    rings = []
    n = 36
    for f, a, b in prof:
        z = zt - f * длина
        amp = 0.015 + 0.075 * f
        ph = ph0 + 1.2 * math.sin(f * 3 + seed)
        bulge = (1 + 0.07 * abs(math.sin(f * длина * math.pi / 0.085))) if пуховик and f > 0.08 else 1.0
        ring = []
        for i in range(n):
            t = 2 * math.pi * i / n
            c, s_ = math.cos(t), math.sin(t)
            r = (1 + amp * math.sin(k * t + ph) + rnd.uniform(-0.01, 0.01)) * bulge
            ring.append((x + 0.01 * f * math.sin(seed) + r * a * math.copysign(abs(c) ** (2/2.6), c),
                         y + b + 0.005 + r * b * math.copysign(abs(s_) ** (2/2.6), s_), z))
        rings.append(ring)
    body = loft(name, rings, mat)
    for sx in (-1, 1):
        L_ = min(длина, 0.72)
        path = [(x + sx*0.19, y + 0.1, zt - 0.1), (x + sx*0.215, y + 0.11, zt - 0.25), (x + sx*0.225, y + 0.12, zt - 0.4),
                (x + sx*0.23, y + 0.125, zt - 0.55), (x + sx*0.225, y + 0.125, zt - L_)]
        sl = []
        for j, ((px, py, pz), r) in enumerate(zip(path, (0.056, 0.056, 0.052, 0.05, 0.044))):
            rb = r * (1 + (0.08 * abs(math.sin(j * 1.7)) if пуховик else 0.03 * math.sin(j * 2.3 + seed)))
            sl.append(ring_h(px, py, pz, rb, rb * 1.1, 16))
        loft(name + "_рукав", sl, mat)
    if капюшон:
        hr = [ring_h(x, y + 0.06, zt - 0.02 - 0.2 * kk, 0.11 * math.sin(math.pi * (0.15 + 0.7 * kk)), 0.065 * math.sin(math.pi * (0.15 + 0.7 * kk)) + 0.01, 20) for kk in (0, 0.25, 0.5, 0.75, 1.0)]
        loft(name + "_капюшон", hr, mat)
        if мех:   # опушка: лохматый валик по краю капюшона
            fr = []
            for j in range(9):
                u = j / 8
                ang = math.pi * (0.1 + 0.8 * u)
                cx = x + 0.12 * math.cos(ang); cz = zt - 0.12 + 0.12 * math.sin(ang) * 0.9
                fr.append(ring_h(cx, y + 0.13, cz, 0.03 + 0.01 * rnd.random(), 0.035, 10, 2.0))
            o = loft(name + "_мех", fr, мех)
    return body

def след(x, y, z, длина, ширина=1.0, n=24):
    """Контур подошвы (вид сверху), носок в +y."""
    pts = []
    for i in range(n):
        t = i / (n - 1)
        yy = y - длина/2 + длина * t
        w = ширина * (0.034 + 0.014 * math.sin(math.pi * min(1, t * 1.15)) ** 0.8)
        if t > 0.86: w *= math.sqrt(max(0.0, 1 - ((t - 0.86) / 0.14) ** 2)) * 0.95 + 0.05
        if t < 0.08: w *= math.sqrt(max(0.0, 1 - ((0.08 - t) / 0.08) ** 2)) * 0.9 + 0.1
        pts.append((x + w, yy))
    return pts + [(2 * x - px, py) for px, py in reversed(pts)]

def кроссовок(x, y, z, верх, низ, длина=0.28, тапок=False, полоски=None, внутри=None):
    """Кроссовок (подошва по контуру стопы, верх ниже к носку, отверстие под ногу, три полоски сбоку)
    или шлёпанец (стелька и выгнутый ремешок с полосками). Носок в +y."""
    contour = след(x, y, z, длина)
    if тапок:
        extrude2d("стелька", contour, "xy", z, z + 0.028, низ, None, None, 0.006)
        rings = []
        for j in range(7):
            u = j / 6
            ang = math.pi * u
            rings.append([(x + 0.05 * math.cos(ang) * 1.02, y + 0.02 + d, z + 0.026 + 0.045 * math.sin(ang)) for d in (-0.035, 0.035)] +
                         [(x + 0.044 * math.cos(ang), y + 0.02 + d, z + 0.026 + 0.039 * math.sin(ang)) for d in (0.035, -0.035)])
        loft("ремешок", rings, верх, cap=True, smooth=1)
        if полоски:
            for k in (-1, 0, 1):
                box("полоска", x - 0.04, y + 0.02 + k * 0.018 - 0.005, z + 0.072, x + 0.04, y + 0.02 + k * 0.018 + 0.005, z + 0.074, полоски, 0.0, None)
        return
    extrude2d("подошва", contour, "xy", z, z + 0.028, низ, None, None, 0.008)
    rings = []
    n = 18
    for kk in range(11):
        t = kk / 10
        yy = y - длина/2 + 0.01 + (длина - 0.02) * t
        w = 0.032 + 0.013 * math.sin(math.pi * min(1, t * 1.15)) ** 0.8
        if t > 0.9: w *= 0.8
        h = 0.085 - 0.05 * max(0, t - 0.35) / 0.65
        if t < 0.06: h *= 0.85
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            ring.append((x + w * math.cos(a), yy, z + 0.026 + h * 0.5 + h * 0.5 * math.sin(a) if math.sin(a) > 0 else z + 0.026 + h * 0.5 + h * 0.5 * math.sin(a) * 0.98))
        rings.append(ring)
    loft("верх", rings, верх)
    if внутри:
        o = cyl("отверстие", 0.032, z + 0.106, z + 0.112, x, y - длина * 0.27, внутри, 24); o.scale = (0.9, 1.5, 1)
    if полоски:
        for sx in (-1, 1):
            for k in range(3):
                st = box("полоска", x + sx * 0.046 - 0.002, y - 0.02 + k * 0.022, z + 0.035, x + sx * 0.046 + 0.002, y - 0.008 + k * 0.022, z + 0.085, полоски, 0.0, None)
                st.rotation_euler = (math.radians(28), 0, 0)

def build():
    clean()
    M = materials()
    M["обои"] = wallpaper()
    M["потолок"] = flat_mat("потолок", (0.93, 0.93, 0.92), 0.9)
    M["пвх"] = flat_mat("пвх", (0.94, 0.94, 0.93), 0.35)
    M["рамы_зелёные"] = flat_mat("рамы_зелёные", (0.05, 0.38, 0.32), 0.4)
    M["плитка_лоджии"] = flat_mat("плитка_лоджии", (0.13, 0.13, 0.14), 0.6)
    M["плитка_розовая"] = flat_mat("плитка_розовая", (0.85, 0.74, 0.7), 0.25)
    M["стена_лоджии"] = flat_mat("стена_лоджии", (0.9, 0.88, 0.72), 0.9)
    M["шторы"] = fabric_mat("шторы", (0.22, 0.36, 0.34))
    M["кирпич"] = flat_mat("кирпич", (0.55, 0.28, 0.16), 0.9)
    M["панелька"] = flat_mat("панелька", (0.82, 0.8, 0.76), 0.9)
    M["земля"] = flat_mat("двор", (0.35, 0.34, 0.32), 0.9)
    M["куртка"] = fabric_mat("куртка", (0.025, 0.03, 0.05), 0.05)
    M["куртка_хаки"] = fabric_mat("куртка_хаки", (0.12, 0.12, 0.07), 0.05)
    M["пуховик"] = puffer_mat("пуховик", (0.03, 0.03, 0.035))
    M["пуховик_синий"] = flat_mat("пуховик_синий", (0.03, 0.045, 0.1), 0.3)
    M["мех"] = flat_mat("мех", (0.28, 0.2, 0.13), 0.95, bump=1.0)
    M["дуб_светлый"] = wood_mat("дуб_светлый", "дуб_светлый_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.7)
    M["коврик"] = flat_mat("коврик", (0.35, 0.05, 0.05), 0.95, bump=0.8)
    M["резина_тёмная"] = flat_mat("резина_тёмная", (0.02, 0.02, 0.025), 0.8)
    M["кроссовки_белые"] = flat_mat("кроссовки_белые", (0.85, 0.85, 0.85), 0.6)
    M["кроссовки_чёрные"] = flat_mat("кроссовки_чёрные", (0.03, 0.03, 0.035), 0.6)
    M["тапки"] = flat_mat("тапки", (0.05, 0.08, 0.25), 0.5)
    M["бутыль"] = glass_mat("бутыль", (0.9, 0.95, 0.97), 0.15)
    M["крышка"] = flat_mat("крышка", (0.1, 0.35, 0.8), 0.4)
    M["плитка_су"] = flat_mat("плитка_су", (0.82, 0.74, 0.6), 0.25)
    M["фаянс"] = flat_mat("фаянс", (0.95, 0.95, 0.94), 0.15)
    M["зеркало"] = flat_mat("зеркало", (0.95, 0.95, 0.95), 0.02, 1.0)
    M["профиль_душа"] = flat_mat("профиль_душа", (0.42, 0.5, 0.45), 0.35, 0.6)
    M["кружка"] = flat_mat("кружка", (0.92, 0.92, 0.9), 0.3)
    from детали import img_mat
    M["пододеяльник_синий"] = img_mat("пододеяльник_синий", "пододеяльник_синий.png", 0.85, 0.2)
    M["пододеяльник_розы"] = img_mat("пододеяльник_розы", "пододеяльник_розы.png", 0.85, 0.2)
    lam = wood_mat("ламинат", "ламинат_diff.jpg", "laminate_floor_02_rough.jpg", "laminate_floor_02_nor.jpg")

    # ---------- пол, потолок
    # доски вдоль комнаты (по X): у текстуры доски идут поперёк V
    f = box("пол", 0.0, 0.0, -0.02, L, W, 0.0, lam, 0, "y"); uv_box(f, tile=1.4, grain="y")
    f = box("пол_коридор", -2.3, 0.0, -0.02, 0.0, 1.15, 0.0, lam, 0, "y"); uv_box(f, tile=1.4, grain="y")
    ceil = wall_box("потолок", -2.42, -0.12, H, L + 0.3, W + 0.12, H + 0.1, M["потолок"])
    # ---------- стены комнаты
    wall_box("стена_стол", -2.42, -0.12, 0, L + 0.3, 0.0, H, M["обои"])            # y=0: стол 1, кровать 1, коридор
    wall_box("стена_холодильник", -0.12, W, 0, L + 0.3, W + 0.12, H, M["обои"])     # y=W
    # стена с дверью x=0: проём y 0.15..0.95, высота 2.05
    wall_box("стена_дверь_1", -0.12, 0.95, 0, 0.0, W, H, M["обои"])
    wall_box("стена_дверь_над", -0.12, 0.15, 2.05, 0.0, 0.95, H, M["обои"])
    wall_box("стена_дверь_2", -0.12, 0.0, 0, 0.0, 0.15, H, M["обои"])
    # наличник
    for y1, y2 in ((0.08, 0.15), (0.95, 1.02)):
        box("наличник", 0.0, y1, 0, 0.012, y2, 2.12, M["ольха"], 0.002, "z")
    box("наличник", 0.0, 0.08, 2.05, 0.012, 1.02, 2.12, M["ольха"], 0.002, "y")
    # стена окна x=L..L+0.3: балконная дверь y 2.35..3.1 (до 2.15), окно y 0.9..2.2 (0.85..2.25)
    X2 = L + 0.3
    wall_box("окно_стена_1", L, 0.0, 0, X2, 0.9, H, M["обои"])
    wall_box("окно_под", L, 0.9, 0, X2, 2.2, 0.85, M["обои"])
    wall_box("окно_над", L, 0.9, 2.25, X2, 2.2, H, M["обои"])   # без перекрытия с простенком: Cycles рисует перекрытия чёрным
    wall_box("окно_простенок", L, 2.2, 0, X2, 2.35, H, M["обои"])
    wall_box("балк_над", L, 2.35, 2.15, X2, 3.1, H, M["обои"])
    wall_box("окно_стена_2", L, 3.1, 0, X2, W, H, M["обои"])
    # окно ПВХ: рама, две створки, стекло, подоконник
    xr = L + 0.2
    for (y1, y2, z1, z2) in ((0.9, 0.97, 0.85, 2.25), (2.13, 2.2, 0.85, 2.25), (0.9, 2.2, 0.85, 0.92), (0.9, 2.2, 2.18, 2.25), (1.52, 1.58, 0.85, 2.25)):
        box("рама", xr, y1, z1, xr + 0.07, y2, z2, M["пвх"], 0.004, None)
    box("стекло_окна", xr + 0.03, 0.97, 0.92, xr + 0.034, 2.13, 2.18, M["стекло"], 0, None)
    box("подоконник", L - 0.08, 0.86, 0.83, xr, 2.24, 0.85, M["пвх"], 0.004, "y")
    for y1, y2 in ((0.9, 0.9), (2.2, 2.2)):
        pass
    # откосы
    box("откос", L, 0.9, 0.85, xr, 0.91, 2.25, M["пвх"], 0, None); box("откос", L, 2.19, 0.85, xr, 2.2, 2.25, M["пвх"], 0, None)
    box("откос", L, 0.9, 2.24, xr, 2.2, 2.25, M["пвх"], 0, None)
    # балконная дверь ПВХ (закрыта), стекло сверху до низа с перекладиной
    for (y1, y2, z1, z2) in ((2.35, 2.42, 0.0, 2.15), (3.03, 3.1, 0.0, 2.15), (2.35, 3.1, 2.08, 2.15), (2.35, 3.1, 0.0, 0.1), (2.35, 3.1, 0.75, 0.82)):
        box("рама_балк", xr, y1, z1, xr + 0.07, y2, z2, M["пвх"], 0.004, None)
    box("стекло_балк", xr + 0.03, 2.42, 0.82, xr + 0.034, 3.03, 2.08, M["стекло"], 0, None)
    box("панель_балк", xr + 0.03, 2.42, 0.1, xr + 0.04, 3.03, 0.75, M["пвх"], 0, None)
    box("ручка_балк", xr - 0.02, 2.44, 1.0, xr, 2.47, 1.15, M["пвх"], 0.005, None)
    # радиатор под окном: 6 секций
    for i in range(6):
        y = 1.65 + i * 0.08
        box("секция", L - 0.1, y, 0.15, L - 0.02, y + 0.075, 0.7, M["пластик_белый"], 0.008, None)
    # плинтус, кабель-канал, плафон, датчик, розетки, выключатель
    for (x1, y1, x2, y2) in ((0, 0, L, 0.015), (0, W - 0.015, L, W), (0.015, 0.95, 0.03, W), (0.015, 0, 0.03, 0.15), (L - 0.015, 0, L, 0.9), (L - 0.015, 2.2, L, 2.35)):
        box("плинтус", x1, y1, 0, x2, y2, 0.06, M["пвх"], 0.002, None)
    for (x1, y1, x2, y2) in ((0, 0, L, 0.025), (0, W - 0.025, L, W), (0, 0.95, 0.025, W)):
        box("кабель_канал", x1, y1, H - 0.04, x2, y2, H - 0.015, M["пвх"], 0.002, None)
    cyl("плафон", 0.18, H - 0.07, H, 2.3, 1.6, M["пластик_белый"], 48)
    cyl("датчик_дыма", 0.05, H - 0.04, H, 0.6, 1.2, M["пластик_белый"], 24)
    for x in (1.55, 1.63):
        box("розетка", x, 0.0, 1.0, x + 0.075, 0.015, 1.075, M["пластик_белый"], 0.004, None)
    box("выключатель", 0.3, 0.0, 1.05, 0.38, 0.015, 1.13, M["пластик_белый"], 0.004, None)

    # ---------- мебель
    place(кровать(M, лента=True, покрывало="пододеяльник_синий"), L - 1.045, 0.0, 0, mirror_y=True)    # кровать 1 у стены со столом
    place(кровать(M, покрывало="пододеяльник_розы"), L - 1.045, W, 0)                                  # кровать 2 у стены с холодильником
    стол_root = стол(M); p = полка(M); p.parent = стол_root; техника_на_стол(M, стол_root)
    place(стол_root, 1.875, 0.0, 180)
    place(комод(M), 1.045, 0.0, 180)
    place(шкаф(M, открыт=0.45), 0.0, 1.85, 90)     # левая дверь чуть отъехала — видно вещи
    place(тумба_свч(M), 0.0, 2.95, 90)
    place(столик(M), 1.15, W, 0)
    place(холодильник(M), 2.1, W, 0)
    place(тумбочка(M, "ольха", "выкл"), L, 1.375, -90)
    place(стул(M), 2.0, 0.85, 0)
    place(стул(M), 1.15, 2.3, 180)
    place(дверь_комнаты(M, открыта=80), 0.0, 0.55, 90)
    # мелочь: полка, шкаф, холодильник, столы, подоконник, тумбочка — blender/мелочь.py
    from мелочь import наполнить
    наполнить(L, W)
    from детали import у_стола, на_изголовье, в_шкафу, санузел, в_коридоре, вид
    у_стола(L, W); на_изголовье(L); в_шкафу(); в_коридоре()
    # шторы, раздвинуты: у стены со столом и у балконной двери
    box("карниз", L - 0.12, 0.0, 2.5, L - 0.1, W, 2.53, M["пвх"], 0.002, None)
    _ring.clear()
    curtain("штора_1", 0.0, 0.72, L - 0.12, 0.03, 2.48, M["шторы"], 6, 0.09, seed=2, lean=-0.06)
    curtain("штора_2", 2.5, W, L - 0.12, 0.03, 2.48, M["шторы"], 6, 0.09, seed=5, lean=0.05)

    # ---------- коридор и санузел за стеной с дверью
    wall_box("перегородка_су", -2.3, 1.15, 0, -0.95, 1.25, H, M["обои"])
    wall_box("перегородка_су_2", -0.25, 1.15, 0, -0.12, 1.25, H, M["обои"])
    wall_box("над_дверью_су", -0.95, 1.15, 2.05, -0.25, 1.25, H, M["обои"])
    wall_box("торец_коридора", -2.42, 0.0, 0, -2.3, 2.6, H, M["обои"])
    wall_box("стена_су", -2.42, 2.6, 0, -0.12, 2.72, H, M["обои"])
    box("входная_дверь", -2.3, 0.15, 0.0, -2.255, 0.95, 2.0, M["дуб_светлый"], 0.003, "z")
    for (y1, y2) in ((0.08, 0.15), (0.95, 1.02)):
        box("наличник_вход", -2.3, y1, 0.0, -2.285, y2, 2.07, M["дуб_светлый"], 0.002, "z")
    box("наличник_вход", -2.3, 0.15, 2.0, -2.285, 0.95, 2.07, M["дуб_светлый"], 0.002, "y")
    box("ручка_вход", -2.255, 0.85, 1.0, -2.2, 0.87, 1.02, M["хром"], 0.004, None)
    box("ручка_вход_накладка", -2.255, 0.84, 0.94, -2.248, 0.88, 1.1, M["хром"], 0.003, None)
    cyl("глазок", 0.012, 0, 0.01, 0, 0, M["хром"], 16, None, "x").location = (-2.25, 0.55, 1.55)
    box("коврик", -2.25, 0.3, 0.0, -1.85, 0.9, 0.012, M["коврик"], 0.004, None)
    box("вешалка_полка", -1.15, 0.0, 1.75, -0.15, 0.3, 1.77, M["дуб_светлый"], 0.003, "x")
    box("вешалка_планка", -1.15, 0.0, 1.55, -0.15, 0.02, 1.65, M["дуб_светлый"], 0.003, "x")
    box("обувная_полка", -1.15, 0.0, 0.3, -0.15, 0.3, 0.32, M["дуб_светлый"], 0.003, "x")
    for k, x in enumerate((-1.0, -0.74, -0.48, -0.25)):
        cyl("крючок", 0.007, 0, 0.06, 0, 0, M["хром"], 12, None, "y").location = (x, 0.05, 1.6)
    куртка("парка", -0.98, 0.02, M["пуховик_синий"], капюшон=True, длина=0.85, seed=1, мех=M["мех"])
    куртка("пуховик", -0.74, 0.07, M["пуховик"], капюшон=True, длина=0.7, seed=2, пуховик=True)
    куртка("куртка_тёмная", -0.5, 0.11, M["куртка"], длина=0.66, seed=3)
    kp = box("кепка", -0.6, 0.08, 1.77, -0.4, 0.26, 1.83, M["куртка_хаки"], 0, None)
    soft(kp, 2, 0.03)
    W_ = M["кроссовки_белые"]; B_ = M["кроссовки_чёрные"]; N_ = M["тапки"]; R_ = M["резина_тёмная"]
    for dx in (-0.06, 0.06):
        кроссовок(-0.95 + dx, 0.16, 0.32, B_, W_, полоски=W_, внутри=R_)                       # чёрные с полосками
        кроссовок(-0.62 + dx, 0.16, 0.32, W_, W_, полоски=N_, внутри=R_)                       # белые беговые
        кроссовок(-1.6 + dx, 0.4, 0.0, N_, R_, тапок=True, полоски=W_)                        # синие шлёпанцы
        кроссовок(-1.25 + dx, 0.78, 0.0, N_, R_, тапок=True, полоски=W_)
    d = box("дверь_су", -0.95, 1.2, 0.0, -0.91, 1.9, 2.0, M["ольха"], 0.003, "z")    # открыта в коридор
    # санузел: плитка на полу и стенах, душ, унитаз, раковина с зеркалом, стояк
    box("пол_су", -2.3, 1.25, -0.02, -0.12, 2.6, 0.005, M["плитка_су"], 0, None)
    санузел(H)   # панели «под мрамор», бордюр, реечный потолок, сушитель, полотенца, зеркало, свет — детали.py
    box("поддон", -2.3, 1.8, 0.0, -1.4, 2.6, 0.12, M["фаянс"], 0.02, None)
    box("стекло_душа", -1.41, 1.8, 0.12, -1.39, 2.6, 1.95, M["стекло_матовое"], 0, None)
    box("стекло_душа_2", -2.3, 1.79, 0.12, -1.4, 1.81, 1.95, M["стекло_матовое"], 0, None)
    for (x1, y1, x2, y2) in ((-1.42, 1.78, -1.38, 1.82), (-1.42, 2.56, -1.38, 2.6), (-2.3, 1.78, -2.26, 1.82)):
        box("профиль_душа", x1, y1, 0.12, x2, y2, 1.97, M["профиль_душа"], 0.003, None)
    # унитаз у стены y=2.6, смотрит на дверь (в -y)
    box("бачок", -0.75, 2.42, 0.4, -0.4, 2.6, 0.78, M["фаянс"], 0.02, None)
    u = cyl("чаша", 0.19, 0.0, 0.4, -0.575, 2.2, M["фаянс"], 32); u.scale = (0.95, 1.25, 1)
    cyl("сиденье", 0.2, 0.4, 0.43, -0.575, 2.2, M["фаянс"], 32).scale = (0.95, 1.25, 1)
    cyl("стояк", 0.03, 0.0, 2.5, -0.22, 2.5, M["пластик_белый"], 20)
    box("раковина", -2.3, 1.3, 0.78, -1.9, 1.75, 0.86, M["фаянс"], 0.03, None)
    cyl("плафон_коридор", 0.13, H - 0.06, H, -1.3, 0.6, M["пластик_белый"], 32)

    # ---------- лоджия и вид
    LX = X2
    box("пол_лоджии", LX, -0.12, -0.02, LX + 1.13, W + 0.12, 0.0, M["плитка_лоджии"], 0, None)
    wall_box("лоджия_бок_1", LX, -0.25, 0, LX + 1.25, -0.12, H, M["стена_лоджии"])
    wall_box("лоджия_бок_2", LX, W + 0.12, 0, LX + 1.25, W + 0.25, H, M["стена_лоджии"])
    wall_box("парапет", LX + 1.13, -0.12, 0, LX + 1.25, W + 0.12, 1.0, M["стена_лоджии"])
    box("парапет_плитка", LX + 1.0, -0.12, 1.0, LX + 1.3, W + 0.12, 1.03, M["плитка_розовая"], 0.003, None)
    wall_box("потолок_лоджии", LX, -0.25, H, LX + 1.3, W + 0.25, H + 0.12, M["потолок"])
    for y in [-0.12 + i * (W + 0.24) / 4 for i in range(5)]:
        box("рама_лоджии", LX + 1.15, y - 0.025, 1.03, LX + 1.2, y + 0.025, H, M["рамы_зелёные"], 0.003, None)
    box("рама_лоджии_низ", LX + 1.15, -0.12, 1.03, LX + 1.2, W + 0.12, 1.09, M["рамы_зелёные"], 0.003, None)
    box("рама_лоджии_верх", LX + 1.15, -0.12, H - 0.06, LX + 1.2, W + 0.12, H, M["рамы_зелёные"], 0.003, None)
    box("стекло_лоджии", LX + 1.17, -0.12, 1.09, LX + 1.172, W + 0.12, H - 0.06, M["стекло"], 0, None)
    вид(L, W)   # окружение по OpenStreetMap — детали.py
    return ceil

def light_day():
    sc = bpy.context.scene
    w = bpy.data.worlds.new("день"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    sky = w.node_tree.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"; sky.sun_elevation = math.radians(25); sky.sun_rotation = math.radians(190)
    except Exception:
        pass
    w.node_tree.links.new(sky.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.6
    bpy.ops.object.light_add(type="SUN", location=(10, 0, 10))
    sun = bpy.context.object; sun.data.energy = 2.5; sun.data.angle = math.radians(8)
    sun.rotation_euler = (math.radians(62), 0, math.radians(100))
    # порталы в окне и в балконной двери: помогают свету неба зайти в комнату без шума
    for (yc, zc, sy, sz) in ((1.55, 1.55, 1.3, 1.4), (2.72, 1.07, 0.75, 2.1)):
        bpy.ops.object.light_add(type="AREA", location=(L + 0.15, yc, zc))
        p = bpy.context.object; p.data.shape = "RECTANGLE"; p.data.size = sy; p.data.size_y = sz
        p.rotation_euler = (0, math.radians(-90), 0)
        p.data.cycles.is_portal = True
    # плафон не горит, но потолочный свет днём немного добавим мягким заполнением — как в пасмурный день
    bpy.ops.object.light_add(type="AREA", location=(2.3, 1.6, H - 0.1))
    f = bpy.context.object; f.data.energy = 60; f.data.size = 2.0

def свет(режим="день", ночник=False):
    """Режимы света: «день» — пасмурный день из окна; «вечер» — за окном сумерки, горит плафон;
    «ночь» — темно, горит лента над кроватью 1. ночник=True — горит ночник на тумбочке (розовый, как на фото 3).
    То же самое потом станет выключателями в Godot."""
    sc = bpy.context.scene
    if режим == "день":
        light_day()
    else:
        w = bpy.data.worlds.new(режим); sc.world = w; w.use_nodes = True
        bg = w.node_tree.nodes["Background"]
        bg.inputs["Color"].default_value = (0.05, 0.07, 0.12, 1) if режим == "вечер" else (0.01, 0.012, 0.02, 1)
        bg.inputs["Strength"].default_value = 0.6 if режим == "вечер" else 0.3
    warm = flat_mat("плафон_горит", (1, 0.95, 0.85), 0.5, emit=(1.0, 0.86, 0.66))
    if режим == "вечер":
        for ob in bpy.data.objects:
            if ob.name.startswith("плафон") and ob.type == "MESH":
                ob.data.materials.clear(); ob.data.materials.append(warm)
        bpy.ops.object.light_add(type="AREA", location=(2.3, 1.6, H - 0.08))
        l = bpy.context.object; l.data.shape = "DISK"; l.data.size = 0.34; l.data.energy = 160
        l.data.color = (1.0, 0.86, 0.68)
        bpy.ops.object.light_add(type="AREA", location=(-1.3, 0.6, H - 0.07))
        l = bpy.context.object; l.data.shape = "DISK"; l.data.size = 0.25; l.data.energy = 50; l.data.color = (1.0, 0.86, 0.68)
    if режим in ("вечер", "ночь"):
        # лента по верху щита кровати 1: тонкий светильник вдоль щита
        bpy.ops.object.light_add(type="AREA", location=(L - 1.045, 0.04, 1.03))
        l = bpy.context.object; l.data.shape = "RECTANGLE"; l.data.size = 2.0; l.data.size_y = 0.02
        l.data.energy = 10; l.data.color = (1.0, 0.1, 0.25); l.rotation_euler = (math.radians(-90), 0, 0)
    if ночник:
        pink = flat_mat("ночник_горит", (1.0, 0.6, 0.95), 0.4, emit=(1.0, 0.3, 0.85))
        for ob in bpy.data.objects:
            if ob.name.startswith("абажур"):
                ob.data.materials.clear(); ob.data.materials.append(pink)
        bpy.ops.object.light_add(type="POINT", location=(L - 0.2, 1.375, 0.72))
        l = bpy.context.object; l.data.energy = 45; l.data.shadow_soft_size = 0.07; l.data.color = (1.0, 0.35, 0.85)

CAMS = {
    # фото 1: сидя на кровати 2 у окна, смотрю на стол, дверь и шкаф
    "ф1": ((4.0, 1.85, 0.95), (0.0, 0.25, 1.2), 24, (720, 960)),
    # от двери к окну
    # из комнаты наружу через лоджию — сравнить с фото из окна (46 к2, Наличная, Наличная 55)
    "вид": ((L - 0.6, 1.6, 1.55), (L + 30, 1.0, -1.0), 24, (720, 960)),
    # санузел: зеркало, раковина, полотенцесушитель
    "санузел": ((-0.45, 1.45, 1.6), (-2.3, 1.75, 1.2), 20, (720, 960)),
    # полка над столом и стол крупно — проверить мелочь
    "полка": ((1.95, 1.9, 1.35), (1.9, 0.1, 1.45), 26, (960, 720)),
    # из комнаты в коридор: вешалка, обувь, санузел
    "коридор": ((0.9, 0.75, 1.55), (-1.2, 0.2, 1.05), 22, (720, 960)),
    "окно": ((0.7, 1.7, 1.55), (4.6, 1.6, 1.25), 22, (960, 720)),
}

def camera(name):
    loc, tgt, lens, (rw, rh) = CAMS[name]
    bpy.ops.object.camera_add(location=loc)
    cam = bpy.context.object
    cam.data.lens = lens; cam.data.sensor_width = 36; cam.data.sensor_fit = "AUTO"
    d = Vector(tgt) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return rw, rh

def top_camera():
    bpy.ops.object.camera_add(location=(1.2, 1.6, 9.0))
    cam = bpy.context.object
    cam.data.type = "ORTHO"; cam.data.ortho_scale = 8.4
    cam.rotation_euler = (0, 0, 0)
    bpy.context.scene.camera = cam
    return 1400, 760

if __name__ == "__main__":
    shots = [a for a in sys.argv[1:] if not a.startswith("--")] or ["ф1", "окно", "сверху"]
    режим = next((a.split("=")[1] for a in sys.argv if a.startswith("--свет=")), "день")
    ночник = "--ночник" in sys.argv
    for shot in shots:
        ceil = build()
        свет(режим, ночник)
        if shot == "сверху":
            rw, rh = top_camera()
            for ob in bpy.data.objects:   # без потолков, чтобы было видно сверху
                if ob.name.startswith(("потолок", "плафон", "датчик")):
                    ob.hide_render = True
        else:
            rw, rh = camera(shot)
        sc = bpy.context.scene
        sc.cycles.max_bounces = 8
        sc.view_settings.exposure = 1.0
        if режим != "день": sc.view_settings.exposure = 0.3
        tag = "" if режим == "день" and not ночник else f"_{режим}" + ("_ночник" if ночник else "")
        render(os.path.join(SHOTS, f"комната_{shot}{tag}.png"), rw, rh, 32 if FAST else 128)
