# Мебель комнаты в общаге — модели скриптом в Blender (bpy), размеры в метрах из схемы (схема/план.png).
# Запуск: $NORA/blender/bin/python blender/мебель.py [--render]
#   без ключа — только экспорт в models/*.glb (геометрия, UV, имена материалов; текстуры подключает Godot);
#   --render — ещё и превью каждой модели в shots/ (Cycles на процессоре, ~1–2 мин на кадр).
# Свои координаты у каждой модели: пол z=0, стена за спиной — плоскость y=0, лицевая сторона смотрит в -y.
import bpy, bmesh, math, sys, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEX = os.path.join(ROOT, "textures")
RENDER = "--render" in sys.argv

# ---------------------------------------------------------------- сцена и материалы

def clean():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def img(name):
    return bpy.data.images.load(os.path.join(TEX, name), check_existing=True)

def wood_mat(name, diff, rough, nor, rough_k=1.0, nor_k=0.12):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = img(diff)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    r = nt.nodes.new("ShaderNodeTexImage"); r.image = img(rough); r.image.colorspace_settings.name = "Non-Color"
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = rough_k
    nt.links.new(r.outputs["Color"], mul.inputs[0]); nt.links.new(mul.outputs[0], bsdf.inputs["Roughness"])
    n = nt.nodes.new("ShaderNodeTexImage"); n.image = img(nor); n.image.colorspace_settings.name = "Non-Color"
    nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = nor_k
    nt.links.new(n.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m

def flat_mat(name, color, rough=0.5, metal=0.0, emit=None, bump=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 6.0
    if bump:   # ткань: мелкая неровность, только для превью
        nt = m.node_tree
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 180
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def quilt_mat(name, color):
    """Стёганое покрывало: ромбы прострочки (две диагональные волны), мягкая ткань."""
    m = flat_mat(name, color, 0.92)
    from материалы import normal_map
    normal_map(m, "покрывало_normal.png")
    return m

def materials():
    from материалы import generate
    generate()
    M = {}
    M["ольха"] = wood_mat("ольха", "ольха_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.7)
    M["дуб"] = wood_mat("дуб", "дуб_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.8)
    M["латунь"] = flat_mat("латунь", (0.62, 0.48, 0.25), 0.35, 1.0)
    M["дуб_светлый"] = wood_mat("дуб_светлый", "дуб_светлый_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.7)
    M["подсветка_клав"] = flat_mat("подсветка_клав", (0.2, 0.9, 0.95), 0.5, emit=(0.15, 0.85, 0.95))
    M["алюминий"] = flat_mat("алюминий", (0.75, 0.76, 0.78), 0.3, 1.0)
    M["матрас"] = flat_mat("матрас", (0.86, 0.86, 0.84), 0.9, bump=0.15)
    M["простыня"] = flat_mat("простыня", (0.55, 0.78, 0.76), 0.85, bump=0.2)
    M["одеяло"] = quilt_mat("покрывало_бежевое", (0.42, 0.4, 0.33))
    M["одеяло_зелёное"] = quilt_mat("покрывало_зелёное", (0.22, 0.31, 0.23))
    M["наволочка"] = flat_mat("наволочка", (0.9, 0.9, 0.88), 0.85, bump=0.2)
    M["наклейка"] = flat_mat("наклейка", (0.95, 0.35, 0.5), 0.6)
    M["лента"] = flat_mat("лента", (1.0, 0.1, 0.25), 0.5, emit=(1.0, 0.08, 0.2))
    M["вешалка"] = flat_mat("вешалка_рубашка", (0.92, 0.92, 0.9), 0.85, bump=0.2)
    M["хром"] = flat_mat("хром", (0.9, 0.9, 0.92), 0.12, 1.0)
    M["фанера"] = wood_mat("фанера", "дуб_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.6)
    M["серебро"] = flat_mat("серебристый_металл", (0.62, 0.63, 0.65), 0.35, 0.8)
    M["пластик_белый"] = flat_mat("пластик_белый", (0.9, 0.9, 0.88), 0.4)
    M["пластик_чёрный"] = flat_mat("пластик_чёрный", (0.025, 0.025, 0.028), 0.45)
    M["экран"] = flat_mat("экран", (0.01, 0.01, 0.012), 0.08)
    M["стекло_тёмное"] = flat_mat("стекло_тёмное", (0.03, 0.03, 0.03), 0.05)
    M["столешница_белая"] = flat_mat("столешница_белая", (0.83, 0.81, 0.75), 0.47)
    M["стекло_матовое"] = glass_mat("стекло_матовое", (0.78, 0.86, 0.8), 0.35)
    M["стекло"] = glass_mat("стекло", (0.95, 0.97, 0.96), 0.0)
    M["ночник"] = flat_mat("ночник", (0.95, 0.95, 0.95), 0.4)
    M["ночник_розовый"] = flat_mat("ночник_розовый", (1.0, 0.5, 0.9), 0.4, emit=(1.0, 0.25, 0.85))
    for i, c in enumerate([(0.9, 0.75, 0.1), (0.85, 0.15, 0.1), (0.15, 0.45, 0.85), (0.2, 0.7, 0.3), (0.95, 0.95, 0.9)]):
        M[f"магнит_{i}"] = flat_mat(f"магнит_{i}", c, 0.4)
    # Ламинированная мебель на фото полуматовая. Сильная карта глянца и
    # normal map раньше делали фасады похожими на мокрый шпон.
    for key in ("ольха", "дуб", "дуб_светлый", "фанера"):
        node = M[key].node_tree.nodes["Principled BSDF"]
        for link in list(node.inputs["Roughness"].links):
            M[key].node_tree.links.remove(link)
        node.inputs["Roughness"].default_value = 0.72
    return M

def glass_mat(name, color, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["IOR"].default_value = 1.45
    return m

# ---------------------------------------------------------------- геометрия

def uv_box(ob, tile=0.6, grain=None):
    """UV «коробкой» в метрах мира: волокно (V текстуры) идёт вдоль grain ('x','y','z') или вдоль
    самой длинной стороны детали. tile — сколько метров на одно повторение текстуры."""
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    dims = ob.dimensions
    ax = {"x": 0, "y": 1, "z": 2}
    g = ax[grain] if grain else max(range(3), key=lambda i: dims[i])
    for f in bm.faces:
        n = f.normal
        a = max(range(3), key=lambda i: abs(n[i]))
        rest = [i for i in range(3) if i != a]
        v_ax = g if g in rest else max(rest, key=lambda i: dims[i])
        u_ax = [i for i in rest if i != v_ax][0]
        for l in f.loops:
            co = ob.matrix_world @ l.vert.co
            l[uv].uv = (co[u_ax] / tile, co[v_ax] / tile)
    bm.to_mesh(me); bm.free()

def finish(ob, mat, bevel=0.0015, grain=None, parent=None, uv=True):
    ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    ob.select_set(False)
    if uv: uv_box(ob, grain=grain)
    if bevel:
        md = ob.modifiers.new("фаска", "BEVEL"); md.width = bevel; md.segments = 2; md.limit_method = "ANGLE"
    for p in ob.data.polygons: p.use_smooth = False
    if parent: ob.parent = parent
    return ob

def box(name, x1, y1, z1, x2, y2, z2, mat, bevel=0.0015, grain=None, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=((x1+x2)/2, (y1+y2)/2, (z1+z2)/2))
    ob = bpy.context.object; ob.name = name
    ob.scale = (abs(x2-x1), abs(y2-y1), abs(z2-z1))
    return finish(ob, mat, bevel, grain, parent)

def cyl(name, r, z1, z2, x, y, mat, verts=24, parent=None, axis="z", bevel=0.0):
    h = z2 - z1
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=h, location=(x, y, (z1+z2)/2))
    ob = bpy.context.object; ob.name = name
    if axis == "x": ob.rotation_euler = (0, math.pi/2, 0)
    if axis == "y": ob.rotation_euler = (math.pi/2, 0, 0)
    ob = finish(ob, mat, bevel, "z", parent)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def arc_solid(name, cx, cy, r_in, r_out, a1, a2, z1, z2, mat, segs=16, parent=None):
    """Кольцевой сектор по углам a1..a2 (градусы, 0 = +x, 90 = +y), вытянутый по z.
    r_in = 0 — сектор круга (полка), r_in > 0 — гнутая стенка."""
    bm = bmesh.new()
    pts_out = [(cx + r_out*math.cos(math.radians(a1 + (a2-a1)*i/segs)), cy + r_out*math.sin(math.radians(a1 + (a2-a1)*i/segs))) for i in range(segs+1)]
    if r_in > 0:
        pts_in = [(cx + r_in*math.cos(math.radians(a1 + (a2-a1)*i/segs)), cy + r_in*math.sin(math.radians(a1 + (a2-a1)*i/segs))) for i in range(segs+1)]
        ring = pts_out + pts_in[::-1]
    else:
        ring = [(cx, cy)] + pts_out
    vb = [bm.verts.new((x, y, z1)) for x, y in ring]
    face = bm.faces.new(vb)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z = z2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob = finish(ob, mat, 0.0015, "x", parent)
    for p in ob.data.polygons:
        if abs(p.normal.z) < 0.5: p.use_smooth = True
    return ob

def profile_x(name, pts_yz, x1, x2, mat, parent=None):
    """Плоский профиль в плоскости yz, вытянутый по x от x1 до x2."""
    bm = bmesh.new()
    vb = [bm.verts.new((x1, y, z)) for y, z in pts_yz]
    face = bm.faces.new(vb)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.x = x2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return finish(ob, mat, 0.002, "y", parent)

def extrude2d(name, pts, plane, a1, a2, mat, parent=None, grain=None, bevel=0.002):
    """Контур pts в плоскости plane ('yz' — тянем по x, 'xz' — по y, 'xy' — по z) от a1 до a2."""
    bm = bmesh.new()
    def P(u, v, w):
        return {"yz": (w, u, v), "xz": (u, w, v), "xy": (u, v, w)}[plane]
    vb = [bm.verts.new(P(u, v, a1)) for u, v in pts]
    face = bm.faces.new(vb)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    k = {"yz": 0, "xz": 1, "xy": 2}[plane]
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co[k] = a2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    return finish(ob, mat, bevel, grain, parent)

def arch_pts(x1, x2, z1, z2, rise, segs=16):
    """Контур филёнки с арочным верхом (стрелка дуги rise) в плоскости xz."""
    pts = [(x1, z1), (x2, z1), (x2, z2 - rise)]
    w = (x2 - x1) / 2; c = (x1 + x2) / 2
    R_ = (w*w + rise*rise) / (2*rise); cz = z2 - R_
    a0 = math.asin(w / R_)
    for i in range(1, segs):
        a = a0 - 2*a0*i/segs
        pts.append((c + R_*math.sin(a), cz + R_*math.cos(a)))
    pts.append((x1, z2 - rise))
    return pts

def thick_line(pts, t):
    """Полоса толщиной t вокруг ломаной pts (2D) — для гнутой фанеры."""
    import itertools
    left, right = [], []
    n = len(pts)
    for i in range(n):
        p0 = Vector(pts[max(i-1, 0)]); p1 = Vector(pts[min(i+1, n-1)])
        d = (p1 - p0).normalized(); nrm = Vector((-d.y, d.x))
        p = Vector(pts[i])
        left.append(tuple(p + nrm*t/2)); right.append(tuple(p - nrm*t/2))
    return left + right[::-1]

def bent_sheet(name, line, t, x1, x2, mat, parent=None):
    """Гнутый лист толщиной t: средняя линия line в плоскости yz, ширина по x от x1 до x2. Собирается
    из четырёхугольников, без больших вогнутых граней."""
    prof = thick_line(line, t)
    n = len(line)
    top, bot = prof[:n], prof[n:][::-1]
    bm = bmesh.new()
    def ring(x): return [bm.verts.new((x, y, z)) for y, z in top], [bm.verts.new((x, y, z)) for y, z in bot]
    (ta, ba), (tb, bb) = ring(x1), ring(x2)
    for i in range(n - 1):
        bm.faces.new((ta[i], ta[i+1], tb[i+1], tb[i]))
        bm.faces.new((ba[i+1], ba[i], bb[i], bb[i+1]))
        bm.faces.new((ta[i+1], ta[i], ba[i], ba[i+1]))
        bm.faces.new((tb[i], tb[i+1], bb[i+1], bb[i]))
    for i in (0, n - 1):
        bm.faces.new((ta[i], tb[i], bb[i], ba[i]) if i == 0 else (tb[i], ta[i], ba[i], bb[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob = finish(ob, mat, 0.0, "y", parent)
    for p in ob.data.polygons: p.use_smooth = True
    return ob

def round_corners(pts, r=0.04, steps=6):
    """Скругляет углы ломаной (3D точки) квадратичной кривой — для гнутых трубок."""
    P = [Vector(p) for p in pts]
    out = [P[0]]
    for i in range(1, len(P) - 1):
        a, b, c = P[i-1], P[i], P[i+1]
        rr = min(r, (b-a).length/2, (c-b).length/2)
        s0 = b + (a-b).normalized()*rr; s1 = b + (c-b).normalized()*rr
        for k in range(steps + 1):
            t = k/steps
            out.append((1-t)**2*s0 + 2*(1-t)*t*b + t*t*s1)
    out.append(P[-1])
    return out

def tube(name, pts, r, mat, parent=None, rr=0.05):
    """Трубка радиуса r по ломаной pts со скруглёнными углами."""
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    P = round_corners(pts, rr)
    sp.points.add(len(P) - 1)
    for i, p in enumerate(P): sp.points[i].co = (p.x, p.y, p.z, 1)
    cu.bevel_depth = r; cu.bevel_resolution = 3; cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu); bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.convert(target="MESH"); ob.select_set(False)
    ob.data.materials.append(mat)
    for p in ob.data.polygons: p.use_smooth = True
    if parent: ob.parent = parent
    return ob

def rounded_rect_yz(y1, y2, z1, z2, r, segs=10):
    """Прямоугольник со скруглёнными верхними углами (радиус r) — контур в yz."""
    ya, yb = max(y1, y2), min(y1, y2)
    pts = [(ya, z1), (yb, z1)]
    for i in range(segs + 1):                      # угол у yb: от 180° до 90°
        a = math.radians(180 - 90 * i / segs)
        pts.append((yb + r + r * math.cos(a), z2 - r + r * math.sin(a)))
    for i in range(segs + 1):                      # угол у ya: от 90° до 0°
        a = math.radians(90 - 90 * i / segs)
        pts.append((ya - r + r * math.cos(a), z2 - r + r * math.sin(a)))
    return pts

def drape(name, x1, x2, y_wall, y_edge, z_top, hang, mat, parent=None, seed=1):
    """Покрывало: лежит на матрасе от стены до края и свисает с края на hang вниз; мелкие складки."""
    import random
    rnd = random.Random(seed)
    nx, ny = 36, 30
    flat = y_wall - y_edge
    rad = 0.05
    total = flat + math.pi * rad / 2 + hang
    bm = bmesh.new()
    grid = []
    waves = [(rnd.uniform(2, 6), rnd.uniform(0, 6.28), rnd.uniform(0.004, 0.012)) for _ in range(4)]
    for j in range(ny + 1):
        s = total * j / ny
        row = []
        for i in range(nx + 1):
            x = x1 + (x2 - x1) * i / nx
            if s <= flat:
                y, z = y_wall - s, z_top
            elif s <= flat + math.pi * rad / 2:
                a = (s - flat) / rad
                y, z = y_edge - rad * math.sin(a), z_top - rad + rad * math.cos(a)
            else:
                y, z = y_edge - rad, z_top - rad - (s - flat - math.pi * rad / 2)
            w = sum(amp * math.sin(f * x * 6.28 + ph + s * (3 + 0.3 * f)) for f, ph, amp in waves)
            if s > flat: y -= abs(w) * 1.5
            else:
                z += w * 0.6 + 0.018 * math.exp(-((x - (x1 + x2) / 2) / 0.35) ** 2
                                               - ((s - flat * 0.55) / 0.3) ** 2)
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    uv = bm.loops.layers.uv.verify()
    for j in range(ny):
        for i in range(nx):
            face = bm.faces.new((grid[j][i], grid[j][i+1], grid[j+1][i+1], grid[j+1][i]))
            coords = ((i / nx, j / ny), ((i + 1) / nx, j / ny),
                      ((i + 1) / nx, (j + 1) / ny), (i / nx, (j + 1) / ny))
            for loop, (uu, vv) in zip(face.loops, coords):
                loop[uv].uv = (uu * (x2 - x1), vv * total)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    so = ob.modifiers.new("толщина", "SOLIDIFY"); so.thickness = 0.018; so.offset = 1
    sd = ob.modifiers.new("гладко", "SUBSURF"); sd.levels = 1; sd.render_levels = 2
    for p in ob.data.polygons: p.use_smooth = True
    if parent: ob.parent = parent
    return ob

def empty(name, loc=(0, 0, 0)):
    ob = bpy.data.objects.new(name, None); ob.location = loc
    bpy.context.collection.objects.link(ob)
    return ob

def soft(ob, levels=2, bevel=None):
    """Мягкие вещи — матрас, подушка, одеяло: скругление и сглаживание."""
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    if bevel:
        md = ob.modifiers.new("фаска", "BEVEL"); md.width = bevel; md.segments = 4
    sd = ob.modifiers.new("гладко", "SUBSURF"); sd.levels = levels; sd.render_levels = levels
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# ---------------------------------------------------------------- модели

def кровать(M, лента=False, покрывало="одеяло", seed=1, низкое_изножье=False):
    """Кровать 0,9 × 2,0 с Г-образным щитом: изголовье у стены окна (+x), щит вдоль стены (y=0).
    Голова — к +x. Матрас сверху на 0,45."""
    root = empty("Кровать")
    L, W = 2.0, 0.9
    x0, x1 = -L/2, L/2
    t = 0.022
    # Верх и верхний паз Г-образного щита идут на одном уровне через угол.
    for i, (z1, z2) in enumerate([(0.38, 0.52), (0.525, 0.785), (0.79, 1.05)]):
        box(f"щит_доска_{i}", x0 - 0.02, 0.0, z1, x1 + 0.02, -t, z2, M["ольха"], 0.002, "x", root)
    # изголовье: от пола до 1,05, 4 доски
    hx = x1 + 0.02
    for i, (z1, z2) in enumerate([(0.0, 0.26), (0.265, 0.52), (0.525, 0.785), (0.79, 1.05)]):
        box(f"изголовье_доска_{i}", hx, 0.0, z1, hx + t, -(W + 0.06), z2, M["ольха"], 0.002, "y", root)
    # царги
    zc1, zc2 = 0.12, 0.33
    box("царга_у_стены", x0, -t - 0.005, zc1, x1, -2*t - 0.005, zc2, M["ольха"], 0.002, "x", root)
    box("царга_с_края", x0, -W + t, zc1, x1, -W, zc2, M["ольха"], 0.002, "x", root)
    # изножье: низкая спинка со скруглённым верхом
    foot_top = 0.35 if низкое_изножье else 0.43
    profile_x("изножье", rounded_rect_yz(-t - 0.005, -W, 0.0, foot_top, 0.09), x0 - t, x0, M["ольха"], root)
    # ножки у изголовья — круглые
    for y in (-0.05, -W + 0.04):
        cyl("ножка", 0.03, 0.0, zc1 + 0.02, x1 - 0.05, y, M["ольха"], 20, root)
    # ламели (видны снизу)
    for i in range(12):
        x = x0 + 0.12 + i * (L - 0.24) / 11
        box("ламель", x - 0.03, -t - 0.01, 0.28, x + 0.03, -W + t + 0.01, 0.30, M["дуб"], 0.001, "y", root)
    # матрас, простыня, подушка, одеяло
    m = box("матрас", x0 + 0.01, -0.035, 0.30, x1 - 0.01, -W + 0.02, 0.44, M["матрас"], 0, None, root)
    soft(m, 2, 0.03)
    s = box("простыня", x0 + 0.005, -0.03, 0.435, x1 - 0.005, -W + 0.015, 0.45, M["простыня"], 0, None, root)
    soft(s, 1, 0.006)
    p = box("подушка", x1 - 0.5, -0.12, 0.45, x1 - 0.06, -W + 0.1, 0.58, M["наволочка"], 0, None, root)
    soft(p, 3, 0.05)
    texture = bpy.data.textures.new("мягкие_складки_подушки", type="CLOUDS")
    texture.noise_scale = 0.16
    displace = p.modifiers.new("неровность_ткани", "DISPLACE")
    displace.texture = texture
    displace.strength = 0.015
    drape("покрывало", x0 + 0.02, x1 - 0.48, -0.04, -W + 0.01, 0.468, 0.22, M[покрывало], root, seed=seed)
    if лента:
        box("лента_щит", x0, -0.005, 1.05, hx, -0.015, 1.058, M["лента"], 0, "x", root)
        box("лента_изголовье", hx + 0.005, 0.0, 1.05, hx + 0.015, -(W + 0.06), 1.058, M["лента"], 0, "y", root)
    return root

def стол(M, ширина=1.2):
    """Стол 1: 1,2 × 0,6 × 0,75, тумба на 3 ящика справа (у двери), проём для ног слева."""
    root = empty("Стол")
    W, D, H = ширина, 0.6, 0.75
    x0, x1 = -W/2, W/2
    t = 0.022
    box("столешница", x0 - 0.01, 0.0, H - 0.028, x1 + 0.01, -D - 0.02, H, M["ольха"], 0.006, "x", root)
    box("бок_левый", x0, -0.01, 0.0, x0 + t, -D, H - 0.028, M["ольха"], 0.002, "z", root)
    tw = 0.42
    box("тумба_бок_внутр", x1 - tw, -0.01, 0.0, x1 - tw + t, -D, H - 0.028, M["ольха"], 0.002, "z", root)
    box("тумба_бок_наруж", x1 - t, -0.01, 0.0, x1, -D, H - 0.028, M["ольха"], 0.002, "z", root)
    box("тумба_дно", x1 - tw + t, -0.01, 0.0, x1 - t, -D + 0.03, 0.06, M["ольха"], 0.001, "x", root)
    box("задняя_стенка", x0 + t, -0.02, 0.32, x1 - tw, -0.04, H - 0.028, M["ольха"], 0.002, "x", root)
    box("царга_над_ногами", x0 + t, -D + 0.005, H - 0.11, x1 - tw, -D + 0.025, H - 0.028, M["ольха"], 0.002, "x", root)
    # три ящика: фасад с фрезерованной рамкой и квадратная латунная ручка
    gap = 0.004
    z_bot, z_top = 0.065, H - 0.032
    hh = (z_top - z_bot) / 3
    for i in range(3):
        za, zb = z_bot + i*hh + gap/2, z_bot + (i+1)*hh - gap/2
        dr = empty(f"ящик_{i+1}"); dr.parent = root
        xa, xb = x1 - tw + t + gap, x1 - t - gap
        box("фасад", xa, -D + 0.02, za, xb, -D - 0.0, zb, M["ольха"], 0.003, "x", dr)
        # филёнка: приподнятая середина фасада, по краю — фрезерованная рамка
        f = 0.032
        fl = box("филёнка", xa + f, -D, za + f, xb - f, -D - 0.006, zb - f, M["ольха"], 0.0, "x", dr)
        md = fl.modifiers.new("фаска", "BEVEL"); md.width = 0.005; md.segments = 3
        cx, cz = (xa + xb)/2, (za + zb)/2
        box("ручка", cx - 0.016, -D - 0.004, cz - 0.016, cx + 0.016, -D - 0.024, cz + 0.016, M["латунь"], 0.003, None, dr)
        box("короб", xa + 0.01, -0.03, za + 0.02, xb - 0.01, -D + 0.02, zb - 0.04, M["дуб"], 0.001, "y", dr)
    return root

def полка(M):
    """Навесная полка над столом (фото 1 и 2): три доски 1,2 м в два яруса по ~0,31, две стойки;
    между стойками — один широкий пролёт ~0,65, снаружи стоек доски выходят на ~0,27 и скруглены
    к фасаду (открытые угловые полочки). Низ на 1,30, глубина 0,26."""
    root = empty("Полка")
    W, D, t = 1.2, 0.26, 0.018
    r = 0.22
    def доска_pts(segs=12):
        pts = [(-W/2, 0.0), (W/2, 0.0)]
        for i in range(segs + 1):
            a = math.radians(0 - 90 * i / segs)          # от 0° до -90°: правый передний угол
            pts.append((W/2 - r + r*math.cos(a), -D + r + r*math.sin(a)))
        for i in range(segs + 1):
            a = math.radians(-90 - 90 * i / segs)        # от -90° до -180°: левый передний угол
            pts.append((-W/2 + r + r*math.cos(a), -D + r + r*math.sin(a)))
        return pts
    levels = [1.30, 1.615, 1.93]
    for i, z in enumerate(levels):
        extrude2d(f"доска_{i}", доска_pts(), "xy", z, z + t, M["ольха"], root, "x", 0.0015)
    for x in (-0.33 - t/2, 0.33 - t/2):
        box("стойка", x, 0.0, levels[0] + t, x + t, -D, levels[2], M["ольха"], 0.0015, "z", root)
    return root

def шкаф(M, открыт=0.0):
    """Шкаф-купе 1,6 × 0,6 × 2,35, две раздвижные двери «дуб». Слева штанга, справа полки.
    открыт — насколько левая дверь уехала вправо (0..0,78), только для превью."""
    root = empty("Шкаф")
    W, D, H = 1.6, 0.6, 2.35
    x0, x1 = -W/2, W/2
    t = 0.018
    box("бок_левый", x0, 0.0, 0.0, x0 + t, -D + 0.07, H, M["дуб"], 0.0015, "z", root)
    box("бок_правый", x1 - t, 0.0, 0.0, x1, -D + 0.07, H, M["дуб"], 0.0015, "z", root)
    box("крыша", x0, 0.0, H - t, x1, -D + 0.07, H, M["дуб"], 0.0015, "x", root)
    box("дно", x0 + t, 0.0, 0.06, x1 - t, -D + 0.07, 0.06 + t, M["дуб"], 0.0015, "x", root)
    box("цоколь", x0 + t, -D + 0.09, 0.0, x1 - t, -D + 0.11, 0.06, M["дуб"], 0.0015, "x", root)
    box("задник", x0 + t, -0.005, 0.06, x1 - t, -0.01, H - t, M["дуб"], 0.0, "z", root)
    box("перегородка", -t/2, 0.0, 0.06 + t, t/2, -D + 0.08, H - t, M["дуб"], 0.0015, "z", root)
    # слева: полка сверху и штанга
    box("полка_верх_лев", x0 + t, 0.0, 1.98, -t/2, -D + 0.08, 1.98 + t, M["дуб"], 0.0015, "x", root)
    cyl("штанга", 0.012, x0 + t, -t/2, 0, 0, M["алюминий"], 16, root, "x").location = ((x0 + -t/2)/2 + 0, -0.27, 1.88)
    # справа: 6 полок
    for i, z in enumerate([0.42, 0.76, 1.10, 1.44, 1.78, 2.06]):
        box(f"полка_прав_{i}", t/2, 0.0, z, x1 - t, -D + 0.08, z + t, M["дуб"], 0.0015, "x", root)
    # направляющие сверху и снизу
    box("направляющая_верх", x0 + t, -D + 0.07, H - 0.06, x1 - t, -D - 0.005, H - t, M["алюминий"], 0.001, "x", root)
    box("направляющая_низ", x0 + t, -D + 0.07, 0.06, x1 - t, -D - 0.005, 0.075, M["алюминий"], 0.001, "x", root)
    box("фриз", x0, -D + 0.07, H - 0.075, x1, -D - 0.035, H, M["дуб"], 0.002, "x", root)
    # двери: два трека, перекрытие 3 см; вертикальные профили по краям
    dw = W/2 + 0.015
    for name, xa, yb, shift in (("дверь_левая", x0 + 0.005, -D - 0.0, открыт), ("дверь_правая", x1 - 0.005 - dw, -D + 0.03, 0.0)):
        d = empty(name); d.parent = root; d.location = (shift, 0, 0)
        box("полотно", xa, yb, 0.08, xa + dw, yb - 0.018, H - 0.08, M["дуб"], 0.0015, "z", d)
        for px in (xa - 0.004, xa + dw - 0.016):
            box("профиль", px, yb + 0.002, 0.075, px + 0.02, yb - 0.028, H - 0.078, M["алюминий"], 0.002, "z", d)
        if name == "дверь_правая":
            box("наклейка", xa + 0.12, yb - 0.018, H - 0.36, xa + 0.17, yb - 0.0195, H - 0.33, M["наклейка"], 0, None, d)
    return root


def корпус(root, W, D, H, mat, t=0.018, plinth=0.05, доля_крышки=1.0):
    """Корпус тумбы: бока, крышка, дно, задник. Возвращает внутренние границы."""
    x0, x1 = -W/2, W/2
    box("бок_л", x0, 0.0, 0.0, x0 + t, -D, H - t, mat, 0.0015, "z", root)
    box("бок_п", x1 - t, 0.0, 0.0, x1, -D, H - t, mat, 0.0015, "z", root)
    box("крышка", x0 - 0.005, 0.0, H - t, x1 + 0.005, -D * доля_крышки - 0.01, H, mat, 0.003, "x", root)
    box("дно", x0 + t, 0.0, plinth, x1 - t, -D + 0.02, plinth + t, mat, 0.0015, "x", root)
    box("цоколь", x0 + t, -D + 0.03, 0.0, x1 - t, -D + 0.05, plinth, mat, 0.0015, "x", root)
    box("задник", x0 + t, -0.004, plinth, x1 - t, -0.008, H - t, mat, 0.0, "z", root)
    return x0 + t, x1 - t, plinth + t, H - t

def ящик(name, root, xa, xb, za, zb, D, mat, knob, gap=0.003, дуговая_ручка=False):
    dr = empty(name); dr.parent = root
    box("фасад", xa + gap, -D + 0.018, za + gap, xb - gap, -D, zb - gap, mat, 0.003, "x", dr)
    cx, cz = (xa + xb)/2, (za + zb)/2
    if дуговая_ручка:
        tube("ручка", [(cx + u, -D - 0.020 * (1 - (u / 0.061) ** 2), cz - 0.015 * (1 - (u / 0.061) ** 2))
                       for u in (-0.061, -0.04, -0.02, 0, 0.02, 0.04, 0.061)], 0.004, knob, dr, 0.010)
    else:
        box("ручка", cx - 0.015, -D, cz - 0.015, cx + 0.015, -D - 0.02, cz + 0.015, knob, 0.003, None, dr)
    box("короб", xa + 0.02, -0.03, za + 0.02, xb - 0.02, -D + 0.018, zb - 0.03, mat, 0.001, "y", dr)
    return dr

def дверца(name, root, xa, xb, za, zb, D, mat, knob, hinge="л", gap=0.003):
    """Распашная дверца: узел стоит на петле, вращение вокруг z."""
    hx = xa + gap if hinge == "л" else xb - gap
    dn = empty(name, (hx, -D, 0)); dn.parent = root
    w = (xb - xa) - 2*gap
    sx = 1 if hinge == "л" else -1
    a, b = (0, w) if sx > 0 else (-w, 0)
    box("полотно", a, 0.018, za + gap, b, 0.0, zb - gap, mat, 0.003, "z", dn)
    kx = (w - 0.04) * sx
    box("ручка", kx - 0.012, 0.0, zb - 0.09, kx + 0.012, -0.02, zb - 0.06, knob, 0.003, None, dn)
    return dn

def тумба_свч(M):
    """Тумба 0,5 × 0,5 × 0,8 в углу у стены с дверью: ящик сверху, дверца снизу; на ней СВЧ и чайник."""
    root = empty("Тумба_СВЧ")
    D = 0.5
    xa, xb, za, zb = корпус(root, 0.5, D, 0.8, M["ольха"])
    ящик("ящик", root, xa, xb, zb - 0.16, zb, D, M["ольха"], M["латунь"])
    дверца("дверца", root, xa, xb, za, zb - 0.16, D, M["ольха"], M["латунь"], "л")
    # СВЧ и чайник прикреплены к тумбе в scenes/dorm.tscn.
    return root

def тумбочка(M, mat="ольха", ночник=None):
    """Тумбочка 0,45 × 0,4 × 0,6: открытая ниша под крышкой, ниже два ящика. ночник: None / 'выкл' / 'розовый'."""
    root = empty("Тумбочка")
    D = 0.4
    xa, xb, za, zb = корпус(root, 0.45, D, 0.6, M[mat], доля_крышки=2 / 3)
    box("полка_ниши", xa, 0.0, zb - 0.17, xb, -D + 0.01, zb - 0.152, M[mat], 0.0015, "x", root)
    h = (zb - 0.17 - za) / 2
    ящик("ящик_1", root, xa, xb, za + h, zb - 0.17, D, M[mat], M["латунь"], дуговая_ручка=True)
    ящик("ящик_2", root, xa, xb, za, za + h, D, M[mat], M["латунь"], дуговая_ручка=True)
    # Мелочи лежат на полке внутри открытой ниши.
    z = zb - 0.152
    box("пауэрбанк", 0.07, -0.36, z, 0.163, -0.299, z + 0.016,
        M["пластик_чёрный"], 0.004, None, root)
    box("блокнот", -0.026, -0.33, z, 0.043, -0.27, z + 0.009,
        M["пластик_белый"], 0.002, None, root)
    wire = [(-0.113 + 0.052 * math.cos(i * 0.38), -0.326 + 0.036 * math.sin(i * 0.38),
             z + 0.004 + i * 0.00015) for i in range(28)]
    tube("провод_наушников", wire, 0.0013, M["пластик_белый"], root, 0.004)
    for x, y in ((-0.157, -0.36), (-0.07, -0.35)):
        box("наушник", x, y, z, x + 0.014, y + 0.01, z + 0.009,
            M["пластик_белый"], 0.003, None, root)
    if ночник:
        lm = empty("ночник"); lm.parent = root
        from мелочь import lathe
        base = lathe("основание", [(0, 0), (0.058, 0), (0.064, 0.003),
                                  (0.068, 0.013), (0.069, 0.024), (0, 0.024)],
                     M["пластик_белый"], segs=64)
        shade = lathe("рассеиватель", [(0, 0.024), (0.069, 0.024), (0.07, 0.044),
                                      (0.07, 0.169), (0.069, 0.183), (0.066, 0.192),
                                      (0.061, 0.197), (0.052, 0.199), (0, 0.199)],
                      M["ночник_розовый" if ночник == "розовый" else "ночник"], segs=64)
        for part in (base, shade):
            part.parent = lm
            part.location = (0.05, -0.2, 0.6)
        touch = flat_mat("метки_ночника", (0.66, 0.67, 0.68), 0.5)
        for z1, z2, width in ((0.644, 0.648, 0.003), (0.660, 0.720, 0.0013),
                              (0.733, 0.737, 0.003)):
            box("сенсор", 0.05-width, -0.2704, z1, 0.05+width, -0.2697, z2,
                touch, 0.0003, None, lm)
    return root

def комод(M):
    """Светлый комод у двери (фото коридора): 0,5 × 0,42 × 0,75, три ящика с дуговыми металлическими
    ручками, розовая инвентарная наклейка сбоку."""
    root = empty("Комод")
    D = 0.42
    xa, xb, za, zb = корпус(root, 0.5, D, 0.75, M["дуб_светлый"])
    h = (zb - za) / 3
    for i in range(3):
        z1, z2 = za + i * h, za + (i + 1) * h
        dr = empty(f"ящик_{3 - i}"); dr.parent = root
        box("фасад", xa + 0.003, -D + 0.018, z1 + 0.003, xb - 0.003, -D, z2 - 0.003, M["дуб_светлый"], 0.003, "x", dr)
        cz = (z1 + z2) / 2
        tube("ручка", [(-0.06, -D, cz), (-0.06, -D - 0.025, cz), (0.06, -D - 0.025, cz), (0.06, -D, cz)], 0.005, M["серебро"], dr, 0.02)
        box("короб", xa + 0.02, -0.03, z1 + 0.02, xb - 0.02, -D + 0.018, z2 - 0.03, M["дуб_светлый"], 0.001, "y", dr)
    box("наклейка", 0.25, -0.1, 0.62, 0.2501, -0.04, 0.66, M["наклейка"], 0, None, root)
    return root

def столик(M, ширина=1.2):
    """Столик у холодильника: белая столешница шириной до 1,2 м на хромированных ножках, на нём второй монитор."""
    root = empty("Столик")
    W, D, H = ширина, 0.6, 0.75
    box("столешница", -W/2, 0.0, H - 0.025, W/2, -D, H, M["столешница_белая"], 0.004, "x", root)
    for x in (-W/2 + 0.04, W/2 - 0.04):
        for y in (-0.04, -D + 0.04):
            cyl("ножка", 0.016, 0.0, H - 0.025, x, y, M["хром"], 20, root)
    for y in (-0.04, -D + 0.04):
        tube("царга", [(-W/2 + 0.04, y, H - 0.06), (W/2 - 0.04, y, H - 0.06)], 0.01, M["хром"], root)
    монитор(M, root, 0.0, -0.18, H, 0.52)
    dark = M["пластик_чёрный"]
    box("клавиатура_второго_стола", -0.23, -0.46, H, 0.185, -0.315, H + 0.013, dark, 0.004, None, root)
    key = flat_mat("клавиши_второго_стола", (0.055, 0.056, 0.059), 0.55)
    for row in range(5):
        for col in range(15):
            x, y = -0.216 + col * 0.026, -0.449 + row * 0.025
            box("клавиша_второго_стола", x, y, H + 0.013, x + 0.022, y + 0.020, H + 0.017,
                key, 0, None, root)
    box("коврик_второго_стола", 0.20, -0.49, H, 0.39, -0.27, H + 0.003, dark, 0.003, None, root)
    mouse = box("мышь_второго_стола", 0.267, -0.419, H + 0.003,
        0.329, -0.309, H + 0.034, M["стекло_тёмное"], 0, None, root)
    soft(mouse, 2, 0.015)
    x = ширина / 2 - 0.27
    box("второй системный блок", x, -0.49, 0.008, x + 0.19, -0.08, 0.42, dark, 0.006, None, root)
    box("лицевая панель", x + 0.012, -0.495, 0.04, x + 0.178, -0.49, 0.40, M["стекло_тёмное"], 0.002, None, root)
    for z in (0.12, 0.24, 0.36):
        for row in range(4):
            y = z + row * 0.008
            box("щель вентиляции", x + 0.025, -0.496, y, x + 0.165, -0.495, y + 0.002, dark, 0, None, root)
    return root

def монитор(M, parent, x, y, z, w=0.53):
    m = empty("монитор"); m.parent = parent
    h = w * 9/16 + 0.03
    box("рамка", x - w/2, y, z + 0.1, x + w/2, y - 0.022, z + 0.1 + h, M["пластик_чёрный"], 0.004, None, m)
    box("экран", x - w/2 + 0.01, y - 0.022, z + 0.12, x + w/2 - 0.01, y - 0.0225, z + 0.1 + h - 0.01, M["экран"], 0.0, None, m)
    box("ножка", x - 0.02, y + 0.03, z, x + 0.02, y + 0.005, z + 0.12, M["пластик_чёрный"], 0.004, None, m)
    box("подставка", x - 0.11, y + 0.09, z, x + 0.11, y - 0.06, z + 0.012, M["пластик_чёрный"], 0.004, None, m)
    return m

def техника_на_стол(M, parent, ширина=1.2):
    """На стол 1: монитор, колонки, клавиатура, мышь, роутер; под столом у ящиков системный блок."""
    монитор(M, parent, -0.135, -0.12, 0.75, 0.53)
    for sx in (-ширина / 2 + 0.02, 0.19):
        box("колонка", sx, -0.05, 0.75, sx + 0.1, -0.17, 0.92, M["пластик_чёрный"], 0.004, None, parent)
        cyl("динамик", 0.035, -0.172, -0.17, sx + 0.05, 0, M["серебро"], 20, parent, "y").location = (sx + 0.05, -0.175, 0.82)
    # клавиатура: серебристая рамка, чёрные клавиши, под ними бирюзовая подсветка (фото стола)
    box("клавиатура", -0.43, -0.29, 0.75, 0.03, -0.45, 0.768, M["серебро"], 0.004, None, parent)
    box("подсветка", -0.42, -0.3, 0.768, 0.02, -0.44, 0.769, M["подсветка_клав"], 0.0, None, parent)
    for row in range(5):
        for col in range(15):
            kx = -0.415 + col * 0.0288; ky = -0.305 - row * 0.0285
            w_ = 0.024 if not (row == 4 and 4 <= col <= 9) else 0.024
            if row == 4 and 5 <= col <= 9:
                if col != 5: continue
                w_ = 0.024 + 4 * 0.0288      # пробел
            box("клавиша", kx, ky, 0.769, kx + w_, ky - 0.024, 0.782, M["пластик_чёрный"], 0.002, None, parent)
    from мелочь import lathe
    mouse_shell = flat_mat("корпус мыши", (0.017, 0.018, 0.023), 0.36)
    mouse = lathe("мышь", [(0.88, 0), (1, 0.005), (0.97, 0.016), (0.84, 0.023),
                          (0.58, 0.028), (0.24, 0.029), (0, 0.029)],
                  mouse_shell, segs=48)
    mouse.parent = parent
    mouse.location = (0.12, -0.414, 0.754)
    mouse.scale = (0.031, 0.058, 1)
    wheel = cyl("колесо мыши", 0.008, 0.116, 0.124, 0, 0,
                M["стекло_тёмное"], 24, parent, "x")
    wheel.location = (0.12, -0.444, 0.781)
    for x, color in ((0.115, (0.50, 0.07, 0.95)), (0.125, (0.07, 0.2, 1))):
        glow = flat_mat("подсветка мыши", color, 0.4, emit=color)
        box("подсветка колеса", x - 0.0008, -0.456, 0.779, x + 0.0008, -0.433, 0.782, glow, 0.0005, None, parent)
    tube("провод мыши", [(0.12, -0.471, 0.761), (0.119, -0.497, 0.755),
                         (0.165, -0.535, 0.752), (0.244, -0.51, 0.751),
                         (0.28, -0.43, 0.751), (0.26, -0.22, 0.751),
                         (0.26, -0.018, 0.747)], 0.0015, M["пластик_чёрный"], parent, 0.025)
    box("разделение кнопок", 0.1196, -0.453, 0.769, 0.1204, -0.468, 0.778,
        M["стекло_тёмное"], 0, None, parent)
    r = empty("роутер"); r.parent = parent
    box("корпус", 0.3, -0.14, 0.75, 0.44, -0.29, 0.78, M["пластик_белый"], 0.006, None, r)
    for i, ax in enumerate((0.32, 0.38, 0.44)):
        cyl("антенна", 0.007, 0.78, 0.96, ax, -0.15, M["пластик_белый"], 12, r)
    системный_блок(M, parent)

def системный_блок(M, parent):
    """Корпус по видео сборки: тонированная боковина, сетчатый фасад, RGB."""
    root = empty("Системный блок"); root.parent = parent
    root.location = (-0.062, -0.333, 0)
    dark = M["пластик_чёрный"]
    rgb = flat_mat("кулеры_пк", (0.22, 0.22, 0.24), 0.42)
    glass = glass_mat("стекло_пк", (0.20, 0.22, 0.25), 0.18)
    glass.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.18

    def panel(name, lower, upper, material=dark):
        return box(name, *lower, *upper, material, 0.0015, None, root)

    panel("крышка", (-0.10, -0.213, 0.431), (0.10, 0.213, 0.444))
    panel("дно", (-0.10, -0.213, 0.006), (0.10, 0.213, 0.025))
    panel("глухая стенка", (0.094, -0.213, 0.025), (0.10, 0.213, 0.431))
    panel("задняя стенка", (-0.10, 0.205, 0.025), (0.094, 0.213, 0.431))
    panel("тонированное стекло", (-0.100, -0.198, 0.025), (-0.097, 0.205, 0.431), glass)
    panel("кожух блока питания", (-0.094, -0.189, 0.027), (0.094, 0.202, 0.092))
    panel("материнская плата", (0.078, -0.09, 0.115), (0.086, 0.197, 0.404))
    panel("видеокарта", (-0.057, -0.105, 0.151), (0.08, 0.202, 0.181))
    for y in (-0.047, -0.062):
        panel("подсветка памяти", (0.057, y, 0.225), (0.062, y + 0.007, 0.355), rgb)
    for x in (-0.10, 0.083):
        panel("стойка фасада", (x, -0.213, 0.025), (x + 0.017, -0.192, 0.431))
    for z in (0.030, 0.421):
        panel("рамка фасада", (-0.09, -0.213, z), (0.09, -0.192, z + 0.006))
    for i in range(31):
        x = -0.082 + i * 0.0054
        panel("решётка", (x, -0.213, 0.034), (x + 0.0014, -0.211, 0.422))
    for z in (0.119, 0.237, 0.355):
        fan = cyl("лопасти", 0.051, -0.204, -0.191, 0, 0, rgb, 40, root, "y")
        fan.location.z = z
        hub = cyl("ступица", 0.019, -0.206, -0.202, 0, 0, dark, 24, root, "y")
        hub.location.z = z
    for y, z, x, r in ((0.143, 0.344, -0.077, 0.05), (0.045, 0.286, 0.019, 0.042)):
        fan = cyl("внутренний кулер", r, x, x + 0.012, y, 0, rgb, 40, root, "x")
        fan.location = (x + 0.006, y, z)
        hub = cyl("ступица", 0.018, x-0.003, x, y, 0, dark, 24, root, "x")
        hub.location = (x - 0.0015, y, z)


def холодильник(M):
    """Холодильник 0,55 × 0,6 × 1,45, двухкамерный, серебристый, в магнитах. Петли справа (+x).
    Двери — узлы на петле: «дверь_морозилка», «дверь_холодильник», открываются поворотом вокруг z на +угол."""
    import random
    rnd = random.Random(7)
    root = empty("Холодильник")
    W, D, H = 0.55, 0.58, 1.45
    x0, x1 = -W/2, W/2
    t = 0.035
    box("бок_л", x0, 0.0, 0.03, x0 + t, -D, H, M["серебро"], 0.004, "z", root)
    box("бок_п", x1 - t, 0.0, 0.03, x1, -D, H, M["серебро"], 0.004, "z", root)
    box("верх", x0, 0.0, H - t, x1, -D, H, M["серебро"], 0.004, "x", root)
    box("низ", x0, 0.0, 0.03, x1, -D, 0.03 + t, M["серебро"], 0.004, "x", root)
    box("зад", x0, 0.0, 0.03, x1, -0.04, H, M["серебро"], 0.0, "z", root)
    zm = 1.0
    box("перегородка", x0 + t, -0.04, zm - 0.03, x1 - t, -D, zm + 0.02, M["пластик_белый"], 0.003, "x", root)
    for z1, z2 in ((0.03 + t, zm - 0.03), (zm + 0.02, H - t)):
        box("стенка_внутри", x0 + t, -0.04, z1, x1 - t, -0.045, z2, M["пластик_белый"], 0.0, "z", root)
    for z in (0.35, 0.62):
        box("полка_стекло", x0 + t, -0.05, z, x1 - t, -D + 0.06, z + 0.006, M["стекло"], 0.001, "x", root)
    box("ящик_овощи", x0 + t + 0.01, -0.06, 0.07, x1 - t - 0.01, -D + 0.07, 0.24, M["стекло"], 0.003, None, root)
    box("ножки", x0 + 0.03, -0.05, 0.0, x1 - 0.03, -D + 0.05, 0.03, M["пластик_чёрный"], 0.002, None, root)
    box("миска", -0.12, -0.15, H, 0.12, -0.42, H + 0.08, M["пластик_белый"], 0.03, None, root)
    for name, z1, z2 in (("дверь_холодильник", 0.03, zm - 0.004), ("дверь_морозилка", zm + 0.004, H)):
        d = empty(name, (x1, -D, 0)); d.parent = root
        box("полотно", -W, 0.0, z1, 0.0, -0.05, z2, M["серебро"], 0.006, "z", d)
        box("уплотнитель", -W + 0.02, 0.0, z1 + 0.02, -0.02, 0.012, z2 - 0.02, M["пластик_белый"], 0.004, None, d)
        box("ручка", -W + 0.015, -0.05, z1 + 0.05 if name == "дверь_морозилка" else z2 - 0.32, -W + 0.035, -0.07,
            z1 + 0.25 if name == "дверь_морозилка" else z2 - 0.05, M["пластик_чёрный"], 0.006, None, d)
    return root

def стул(M):
    """Стул: гнутая фанера (сиденье и спинка одним листом) на хромированной трубе с подлокотниками.
    Смотрит в -y (сидящий лицом к -y)."""
    root = empty("Стул")
    W = 0.46
    # средняя линия листа фанеры в профиль (y, z): от переднего края сиденья к верху спинки
    line = [(-0.47, 0.425), (-0.45, 0.445)]
    for i in range(1, 9):
        line.append((-0.45 + 0.4*i/8, 0.45 - 0.01*math.sin(math.pi*i/8)))
    for i in range(1, 7):
        a = math.radians(90*i/6)
        line.append((-0.05 + 0.08*math.sin(a), 0.45 + 0.08*(1 - math.cos(a))))
    line += [(0.04, 0.6), (0.06, 0.75), (0.07, 0.86)]
    bent_sheet("фанера", line, 0.012, -W/2, W/2, M["фанера"], root)
    for sx in (-1, 1):
        x = sx * (W/2 + 0.02)
        tube("рама", [(x, -0.44, 0.0), (x, -0.44, 0.64), (x, 0.0, 0.64), (x, 0.05, 0.47), (x, 0.17, 0.0)], 0.011, M["хром"], root, 0.05)
        tube("под_сиденье", [(x, -0.44, 0.40), (x, 0.03, 0.43)], 0.009, M["хром"], root)
        box("подлокотник", x - 0.025, -0.42, 0.648, x + 0.025, -0.1, 0.672, M["фанера"], 0.008, "y", root)
    tube("перемычка", [(-W/2 - 0.02, -0.2, 0.41), (W/2 + 0.02, -0.2, 0.41)], 0.009, M["хром"], root)
    return root

def дверь_комнаты(M, открыта=0.0):
    """Межкомнатная дверь 0,8 × 2,0 с двумя матовыми стёклами с арочным верхом. Узел «полотно» стоит
    на петле (x = -0,4), открывается поворотом вокруг z. Лицевая сторона — -y, в плоскости y=0."""
    root = empty("Дверь_комнаты")
    W, H, T = 0.8, 2.0, 0.04
    leaf = empty("полотно", (-W/2, 0, 0)); leaf.parent = root
    leaf.rotation_euler = (0, 0, -math.radians(открыта))
    x0, x1 = 0.0, W
    # обвязка вокруг двух проёмов: стойки, перекладины
    box("стойка_л", x0, T/2, 0, x0 + 0.13, -T/2, H, M["ольха"], 0.003, "z", leaf)
    box("стойка_п", x1 - 0.13, T/2, 0, x1, -T/2, H, M["ольха"], 0.003, "z", leaf)
    box("низ", x0 + 0.13, T/2, 0, x1 - 0.13, -T/2, 0.22, M["ольха"], 0.003, "x", leaf)
    box("середина", x0 + 0.13, T/2, 0.62, x1 - 0.13, -T/2, 0.78, M["ольха"], 0.003, "x", leaf)
    # верх над арками — сплошной, арки вырезаны контуром
    # нижнее стекло — овальное (фото коридора): рамка из узких столбиков вокруг овала
    cx, cz, ea, eb = W/2, 0.42, 0.19, 0.15
    box("низ_лев", x0 + 0.13, T/2, 0.22, cx - ea, -T/2, 0.62, M["ольха"], 0.0, "z", leaf)
    box("низ_прав", cx + ea, T/2, 0.22, x1 - 0.13, -T/2, 0.62, M["ольха"], 0.0, "z", leaf)
    n = 24
    for i in range(n):
        xa_ = cx - ea + 2 * ea * i / n; xb_ = cx - ea + 2 * ea * (i + 1) / n
        xm = (xa_ + xb_) / 2 - cx
        dz = eb * math.sqrt(max(0.0, 1 - (xm / ea) ** 2))
        box("над_овалом", xa_, T/2, cz + dz, xb_ + 0.001, -T/2, 0.62, M["ольха"], 0.0, "x", leaf)
        box("под_овалом", xa_, T/2, 0.22, xb_ + 0.001, -T/2, cz - dz, M["ольха"], 0.0, "x", leaf)
    oval = [(cx + ea * math.cos(2 * math.pi * k / 48), cz + eb * math.sin(2 * math.pi * k / 48)) for k in range(48)]
    extrude2d("стекло_овал", oval, "xz", -0.004, 0.004, M["стекло_матовое"], leaf, None, 0.0)
    for sy in (-1, 1):
        tube("раскладка_овал", [(px, sy * (T/2 + 0.003), pz) for px, pz in oval + oval[:1]], 0.007, M["ольха"], leaf, 0.0)
    for z1, z2, rise in ((0.78, 1.86, 0.1),):
        top = H if z2 > 1 else 0.62
        pts = arch_pts(x0 + 0.13, x1 - 0.13, z1, z2, rise)
        extrude2d("стекло", pts, "xz", -0.004, 0.004, M["стекло_матовое"], leaf, None, 0.0)
        # перемычка над аркой: прямоугольник минус арка — набираем из узких сегментов
        arc = pts[2:]
        for i in range(len(arc) - 1):
            (ax, az), (bx, bz) = arc[i], arc[i+1]
            xa_, xb_ = min(ax, bx), max(ax, bx)
            box("над_аркой", xa_, T/2, min(az, bz), xb_ + 0.001, -T/2, top, M["ольха"], 0.0, "x", leaf)
        box("раскладка", x0 + 0.11, -T/2, z1 - 0.02, x0 + 0.13, -T/2 - 0.008, z2 - rise, M["ольха"], 0.002, "z", leaf)
        box("раскладка", x1 - 0.13, -T/2, z1 - 0.02, x1 - 0.11, -T/2 - 0.008, z2 - rise, M["ольха"], 0.002, "z", leaf)
    # ручка-нажимная с обеих сторон
    for sy in (-1, 1):
        y = sy * (T/2 + 0.008)
        box("розетка", x1 - 0.085, y, 0.92, x1 - 0.045, y + sy*0.008, 1.08, M["латунь"], 0.004, None, leaf)
        tube("ручка", [(x1 - 0.065, y + sy*0.005, 1.03), (x1 - 0.065, y + sy*0.055, 1.03), (x1 - 0.2, y + sy*0.06, 1.03)], 0.011, M["латунь"], leaf, 0.02)
    return root

# ---------------------------------------------------------------- экспорт и превью

def export(root, name):
    os.makedirs(os.path.join(ROOT, "models"), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    def sel(o):
        o.select_set(True)
        for c in o.children: sel(c)
    sel(root)
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT, "models", name + ".glb"), use_selection=True,
                              export_apply=True, export_materials="PLACEHOLDER", export_format="GLB")
    print("модель:", name)

def stage(target, dist, height, yaw, lens=35):
    """Пол-ламинат, стена за моделью, мягкий свет, камера."""
    sc = bpy.context.scene
    floor = box("пол", -4, 3, -0.02, 4, -4, 0.0, wood_mat("ламинат", "laminate_floor_02_diff.jpg",
               "laminate_floor_02_rough.jpg", "laminate_floor_02_nor.jpg"), 0, "y")
    uv_box(floor, tile=1.4, grain="y")
    box("стена", -4, 0.12, 0, 4, 0.0, 3.2, flat_mat("обои", (0.86, 0.8, 0.62), 0.9, bump=0.5), 0, None)
    w = bpy.data.worlds.new("мир"); sc.world = w; w.use_nodes = True
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.85, 0.87, 0.9, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5
    bpy.ops.object.light_add(type="AREA", location=(target[0] - 1.5, target[1] - 2.5, 2.4))
    key = bpy.context.object; key.data.energy = 220; key.data.size = 2.0
    key.rotation_euler = (math.radians(55), 0, math.radians(-30))
    bpy.ops.object.light_add(type="SUN", location=(0, 0, 5))
    sun = bpy.context.object; sun.data.energy = 1.2; sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    a = math.radians(yaw)
    cam_loc = Vector((target[0] + dist*math.sin(a), target[1] - dist*math.cos(a), height))
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object; cam.data.lens = lens
    d = Vector(target) - cam_loc
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam

def render(path, w=900, h=900, samples=64):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    # В системных сборках Blender (Debian) OIDN может быть выключен.
    # Включённый denoise в таком случае срывает сохранение всего кадра.
    import _cycles
    sc.cycles.use_denoising = bool(getattr(_cycles, "with_openimagedenoise", False))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = "AgX"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("превью:", path)

SHOTS = os.path.join(ROOT, "shots")

def стол_с_полкой(M):
    root = стол(M); p = полка(M); p.parent = root
    техника_на_стол(M, root)
    return root

JOBS = [
    # имя, сборка, вид для превью (цель, дистанция, высота, азимут)
    ("кровать", lambda M: кровать(M), ((0.1, -0.5, 0.45), 3.0, 1.7, -40)),
    ("кровать_с_лентой", lambda M: кровать(M, лента=True), None),
    ("стол", стол_с_полкой, ((0.0, -0.3, 1.0), 2.6, 1.55, 28)),
    ("шкаф", lambda M: шкаф(M), ((0.0, -0.3, 1.2), 3.6, 1.5, -22)),
    ("холодильник", холодильник, ((0.0, -0.3, 0.75), 2.4, 1.3, -30)),
    ("тумба_свч", тумба_свч, ((0.0, -0.25, 0.65), 1.9, 1.3, 30)),
    ("тумбочка", lambda M: тумбочка(M, "ольха", "выкл"), ((0.0, -0.2, 0.35), 1.4, 0.9, -30)),
    ("тумбочка_светлая", lambda M: тумбочка(M, "дуб"), None),
    ("столик", столик, ((0.0, -0.3, 0.6), 2.4, 1.4, 25)),
    ("стул", стул, ((0.0, -0.2, 0.45), 1.8, 1.0, -35)),
    ("дверь_комнаты", lambda M: дверь_комнаты(M), ((0.0, 0.0, 1.0), 3.0, 1.3, 0)),
]

if __name__ == "__main__":
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    for name, make, view in JOBS:
        if only and name not in only: continue
        clean()
        M = materials()
        root = make(M)
        if not RENDER: export(root, name)
        if RENDER and view:
            if name == "шкаф":   # для превью левая дверь отъехала, как на фото 1
                clean(); M = materials(); шкаф(M, открыт=0.62)
            if name == "холодильник":   # для превью дверь холодильника открыта
                clean(); M = materials(); r = холодильник(M)
                bpy.data.objects["дверь_холодильник"].rotation_euler = (0, 0, math.radians(100))
            stage(*view)
            render(os.path.join(SHOTS, f"{name}.png"))
