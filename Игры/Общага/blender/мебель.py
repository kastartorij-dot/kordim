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

def wood_mat(name, diff, rough, nor, rough_k=1.0, nor_k=0.35):
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

def materials():
    M = {}
    M["ольха"] = wood_mat("ольха", "ольха_diff.jpg", "cherry_veneer_rough.jpg", "cherry_veneer_nor.jpg", 0.75)
    M["дуб"] = wood_mat("дуб", "дуб_diff.jpg", "oak_veneer_01_rough.jpg", "oak_veneer_01_nor.jpg", 0.8)
    M["латунь"] = flat_mat("латунь", (0.62, 0.48, 0.25), 0.35, 1.0)
    M["алюминий"] = flat_mat("алюминий", (0.75, 0.76, 0.78), 0.3, 1.0)
    M["матрас"] = flat_mat("матрас", (0.86, 0.86, 0.84), 0.9, bump=0.15)
    M["простыня"] = flat_mat("простыня", (0.55, 0.78, 0.76), 0.85, bump=0.2)
    M["одеяло"] = flat_mat("одеяло", (0.52, 0.5, 0.42), 0.9, bump=0.4)
    M["наволочка"] = flat_mat("наволочка", (0.9, 0.9, 0.88), 0.85, bump=0.2)
    M["наклейка"] = flat_mat("наклейка", (0.95, 0.35, 0.5), 0.6)
    M["лента"] = flat_mat("лента", (1.0, 0.1, 0.25), 0.5, emit=(1.0, 0.08, 0.2))
    M["вешалка"] = flat_mat("вешалка_рубашка", (0.92, 0.92, 0.9), 0.85, bump=0.2)
    return M

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

def кровать(M, лента=False):
    """Кровать 0,9 × 2,0 с Г-образным щитом: изголовье у стены окна (+x), щит вдоль стены (y=0).
    Голова — к +x. Матрас сверху на 0,45."""
    root = empty("Кровать")
    L, W = 2.0, 0.9
    x0, x1 = -L/2, L/2
    t = 0.022
    # щит вдоль стены: 3 доски с пазами, от 0,38 до 1,0
    for i, (z1, z2) in enumerate([(0.38, 0.585), (0.59, 0.795), (0.80, 1.0)]):
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
    fb = box("изножье", x0 - t, -t - 0.005, 0.0, x0, -W, 0.5, M["ольха"], 0.0, "y", root)
    md = fb.modifiers.new("скругление", "BEVEL"); md.width = 0.06; md.segments = 8; md.limit_method = "ANGLE"
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
    o = box("одеяло", x0 + 0.05, -0.05, 0.45, x0 + 0.95, -W - 0.04, 0.52, M["одеяло"], 0, None, root)
    soft(o, 2, 0.025)
    if лента:
        box("лента_щит", x0, -0.005, 1.0, x1, -0.015, 1.008, M["лента"], 0, "x", root)
        box("лента_изголовье", hx + 0.005, 0.0, 1.05, hx + 0.015, -(W + 0.06), 1.058, M["лента"], 0, "y", root)
    return root

def стол(M):
    """Стол 1: 1,2 × 0,6 × 0,75, тумба на 3 ящика справа (у двери), проём для ног слева."""
    root = empty("Стол")
    W, D, H = 1.2, 0.6, 0.75
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
        # рамка-фреза: тонкий выступ по периметру
        f = 0.03
        box("рамка_верх", xa + 0.01, -D, zb - f, xb - 0.01, -D - 0.004, zb - 0.012, M["ольха"], 0.002, "x", dr)
        box("рамка_низ", xa + 0.01, -D, za + 0.012, xb - 0.01, -D - 0.004, za + f, M["ольха"], 0.002, "x", dr)
        box("рамка_лев", xa + 0.012, -D, za + 0.012, xa + f, -D - 0.004, zb - 0.012, M["ольха"], 0.002, "z", dr)
        box("рамка_прав", xb - f, -D, za + 0.012, xb - 0.012, -D - 0.004, zb - 0.012, M["ольха"], 0.002, "z", dr)
        cx, cz = (xa + xb)/2, (za + zb)/2
        box("ручка", cx - 0.016, -D - 0.004, cz - 0.016, cx + 0.016, -D - 0.024, cz + 0.016, M["латунь"], 0.003, None, dr)
        box("короб", xa + 0.01, -0.03, za + 0.02, xb - 0.01, -D + 0.02, zb - 0.04, M["дуб"], 0.001, "y", dr)
    return root

def полка(M):
    """Навесная полка над столом: короб 0,9 с 3 ячейками в 2 яруса и скруглёнными полками по краям.
    Низ на 1,30, ярусы по 0,31, глубина 0,25."""
    root = empty("Полка")
    W, D = 0.9, 0.25
    x0, x1 = -W/2, W/2
    t = 0.018
    levels = [1.30, 1.61, 1.92]
    for i, z in enumerate(levels):
        box(f"доска_{i}", x0, 0.0, z, x1, -D, z + t, M["ольха"], 0.0015, "x", root)
    for x in (x0, -0.15, 0.15, x1 - t):
        box("стойка", x, 0.0, levels[0] + t, x + t, -D, levels[2], M["ольха"], 0.0015, "z", root)
    # скруглённые концы: сектор 90° на каждом уровне, гнутая стенка на верхнем ярусе
    R = 0.24
    for side, (cx, a1, a2) in {"лев": (x0, 180, 270), "прав": (x1, 270, 360)}.items():
        for i, z in enumerate(levels):
            arc_solid(f"угол_{side}_{i}", cx, 0.0, 0.0, R, a1, a2, z, z + t, M["ольха"], 20, root)
        arc_solid(f"гнутая_{side}", cx, 0.0, R - 0.008, R, a1, a2, levels[1] + t, levels[2], M["ольха"], 24, root)
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
    # рубашка на плечиках — чтобы было видно, что слева штанга
    sh = box("рубашка", -0.55, -0.24, 1.05, -0.5, -0.3, 1.86, M["вешалка"], 0, None, root)
    sh.scale = (1, 1, 1); soft(sh, 1, 0.01)
    # направляющие сверху и снизу
    box("направляющая_верх", x0 + t, -D + 0.07, H - 0.06, x1 - t, -D - 0.005, H - t, M["алюминий"], 0.001, "x", root)
    box("направляющая_низ", x0 + t, -D + 0.07, 0.06, x1 - t, -D - 0.005, 0.075, M["алюминий"], 0.001, "x", root)
    # двери: два трека, перекрытие 3 см; вертикальные профили по краям
    dw = W/2 + 0.015
    for name, xa, yb, shift in (("дверь_левая", x0 + 0.005, -D - 0.0, открыт), ("дверь_правая", x1 - 0.005 - dw, -D + 0.03, 0.0)):
        d = empty(name); d.parent = root; d.location = (shift, 0, 0)
        box("полотно", xa, yb, 0.08, xa + dw, yb - 0.018, H - 0.07, M["дуб"], 0.0015, "z", d)
        for px in (xa - 0.004, xa + dw - 0.016):
            box("профиль", px, yb + 0.002, 0.075, px + 0.02, yb - 0.028, H - 0.065, M["алюминий"], 0.002, "z", d)
        if name == "дверь_правая":
            box("наклейка", xa + 0.12, yb - 0.018, H - 0.36, xa + 0.17, yb - 0.0195, H - 0.33, M["наклейка"], 0, None, d)
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
    box("стена", -4, 0.12, 0, 4, 0.0, 2.65, flat_mat("обои", (0.86, 0.8, 0.62), 0.9, bump=0.5), 0, None)
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
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.view_settings.view_transform = "AgX"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("превью:", path)

SHOTS = os.path.join(ROOT, "shots")
jobs = [
    ("кровать", lambda M: кровать(M), ((0.1, -0.5, 0.45), 3.0, 1.7, -40), {}),
    ("кровать_с_лентой", lambda M: кровать(M, лента=True), None, {}),
    ("стол", lambda M: (стол(M), полка(M)), ((0.0, -0.3, 1.0), 2.6, 1.55, 28), {}),
    ("шкаф", lambda M: шкаф(M), ((0.0, -0.3, 1.2), 3.6, 1.5, -22), {}),
]
for name, make, view, _ in jobs:
    clean()
    M = materials()
    made = make(M)
    roots = made if isinstance(made, tuple) else (made,)
    if name == "стол":
        roots[1].location = (0, 0, 0)    # полка висит над столом, в одной модели
        roots[1].parent = roots[0]
    export(roots[0], name)
    if RENDER and view:
        if name == "шкаф":   # для превью левая дверь отъехала, как на фото 1
            clean(); M = materials(); шкаф(M, открыт=0.62)
        stage(*view)
        render(os.path.join(SHOTS, f"{name}.png"))
