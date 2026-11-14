# Детали по второй пачке фото автора: гитара, микрофон и коврик у стола, лента за монитором, коробка и табличка
# на изголовье, вещи в шкафу и синяя сумка, санузел (реечный потолок, панели «под мрамор» с бордюром,
# полотенцесушитель с полотенцами, зеркало со скруглённым углом, светильник, вентиляция), обувь и пакеты
# в коридоре, вид из окна (кирпичный дом напротив, панельки, деревья).
import bpy, math, os, random
from мебель import box, cyl, soft, flat_mat, glass_mat, uv_box, extrude2d, tube, empty, ROOT
from мелочь import lathe, at, mat, PAL

TEX = os.path.join(ROOT, "textures")

def img_mat(name, file, rough=0.6, bump=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage"); t.image = bpy.data.images.load(os.path.join(TEX, file), check_existing=True)
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    if bump:
        nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 300
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump
        nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def emit_mat(name, color, strength=6.0):
    m = flat_mat(name, color, 0.5, emit=color)
    m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = strength
    return m

# ---------------------------------------------------------------- у стола
def гитара(x, y, z=0.0, наклон=14, поворот=0.0):
    """Акустическая гитара, прислонённая к краю стола у кровати 1 (фото со столом ночью)."""
    root = empty("гитара", (x, y, z))
    дека = mat((0.78, 0.55, 0.3), 0.3); тёмн = mat(PAL["чёрный"], 0.4)
    # корпус: «восьмёрка» из двух эллипсов в плоскости xz, толщина по y
    pts = []
    for i in range(48):
        t = 2 * math.pi * i / 48
        lower = (0.19 * math.cos(t), 0.2 + 0.18 * math.sin(t))
        upper = (0.145 * math.cos(t), 0.47 + 0.13 * math.sin(t))
        pts.append(lower if math.sin(t) < 0.35 else upper)
    body = []
    for i in range(48):   # огибающая двух эллипсов
        t = 2 * math.pi * i / 48
        zz = 0.335 + 0.315 * math.sin(t - math.pi / 2) * -1
        zz = 0.02 + 0.6 * (i / 47 if i < 24 else (47 - i) / 23)
        w = 0.19 if zz < 0.3 else (0.11 if zz < 0.38 else 0.145)
        w *= math.sin(math.pi * min(1, max(0.06, (zz - 0.02) / 0.6))) ** 0.35
        body.append((w if i < 24 else -w, zz))
    ob = extrude2d("корпус", body, "xz", -0.05, 0.05, дека, root, "z", 0.006)
    cyl("розетка", 0.045, -0.052, -0.05, 0, 0, тёмн, 32, root, "y").location = (0, -0.051, 0.38)
    box("подставка_струн", -0.06, -0.06, 0.13, 0.06, -0.05, 0.15, тёмн, 0.003, None, root)
    box("гриф", -0.026, -0.03, 0.6, 0.026, 0.01, 1.05, mat((0.25, 0.15, 0.08), 0.4), 0.004, None, root)
    box("голова", -0.04, -0.02, 1.05, 0.04, 0.005, 1.22, тёмн, 0.006, None, root)
    for k in range(6):
        xx = -0.012 + k * 0.005
        cyl("струна", 0.0006, 0.14, 1.05, xx, -0.035, mat((0.8, 0.8, 0.75), 0.2, "plastic"), 6, root)
    root.rotation_euler = (math.radians(наклон), 0, math.radians(поворот))
    return root

def микрофон(x, y, z):
    blk = mat(PAL["чёрный"], 0.35)
    cyl("основание", 0.06, z, z + 0.015, x, y, blk, 32)
    tube("стойка", [(x, y, z + 0.015), (x, y, z + 0.18), (x + 0.04, y + 0.06, z + 0.3)], 0.006, blk, None, 0.08)
    c = cyl("микрофон", 0.022, z + 0.29, z + 0.37, x + 0.05, y + 0.08, mat((0.15, 0.15, 0.16), 0.3), 24)
    c.rotation_euler = (math.radians(-40), 0, 0)

def у_стола(L, W):
    # стол стоит в (1.875, 0) повёрнут на 180: локальные x → X = 1.875 − x, y → Y = −y
    box("коврик_мыши", 1.875 - 0.32, 0.27, 0.75, 1.875 - 0.04, 0.5, 0.753, mat((0.25, 0.45, 0.12), 0.7), 0.003, None)
    микрофон(1.875 + 0.5, 0.25, 0.75)
    гитара(2.52, 0.9, 0.0, 12, 90)
    # лента за монитором: по стене над столом и вверх у края — «Г», как на ночных фото
    red = emit_mat("лента_стол", (1.0, 0.08, 0.15), 5)
    box("лента_стол", 1.32, 0.002, 0.8, 2.42, 0.01, 0.808, red, 0, None)
    box("лента_стол_верт", 2.412, 0.002, 0.8, 2.42, 0.01, 1.22, red, 0, None)

# ---------------------------------------------------------------- изголовье кровати 1
def на_изголовье(L):
    """Коробка из-под кроссовок и табличка «Big Ben» на изголовье кровати 1 у окна."""
    b = box("коробка_обувь", L - 0.24, 0.12, 1.05, L - 0.02, 0.45, 1.17, mat((0.92, 0.92, 0.9), 0.6), 0.004, None)
    box("коробка_надпись", L - 0.245, 0.15, 1.08, L - 0.24, 0.42, 1.14, mat((0.85, 0.15, 0.15), 0.6), 0, None)
    p = box("табличка", L - 0.06, 0.18, 1.17, L - 0.045, 0.48, 1.42, mat((0.8, 0.8, 0.82), 0.3), 0.01, None)
    box("табличка_надпись", L - 0.0605, 0.21, 1.25, L - 0.06, 0.45, 1.33, mat((0.15, 0.25, 0.6), 0.5), 0, None)
    p.rotation_euler = (0, math.radians(-8), 0)
    cyl("розетка_над_щитом", 0.035, 0, 0.015, 0, 0, mat(PAL["белый"], 0.4), 20, None, "y").location = (L - 0.5, 0.008, 1.2)

# ---------------------------------------------------------------- шкаф: вещи
def в_шкафу():
    """Одежда на плечиках в левой половине шкафа (шкаф у стены x=0, Y 1.05..2.65) и синяя сумка IKEA внизу."""
    rnd = random.Random(11)
    cols = [(0.05, 0.05, 0.06), (0.25, 0.12, 0.35), (0.9, 0.9, 0.9), (0.1, 0.1, 0.25), (0.35, 0.33, 0.3), (0.05, 0.05, 0.06), (0.6, 0.6, 0.62)]
    for i in range(7):
        yy = 1.12 + i * 0.095
        h = rnd.uniform(0.6, 0.95)
        c = box("вещь", 0.06, yy - 0.025, 1.86 - h, 0.52, yy + 0.025, 1.86, mat(cols[i], 0.85), 0, None)
        soft(c, 2, 0.02)
        tube("плечики", [(0.08, yy, 1.84), (0.29, yy, 1.9), (0.5, yy, 1.84)], 0.004, mat((0.5, 0.35, 0.2), 0.4), None, 0.05)
    s = box("сумка_ikea", 0.08, 1.12, 0.08, 0.5, 1.55, 0.5, mat((0.05, 0.25, 0.75), 0.4), 0, None); soft(s, 2, 0.05)
    box("сумка_жёлтая", 0.1, 1.15, 0.45, 0.48, 1.52, 0.5, mat((0.95, 0.8, 0.1), 0.4), 0, None)

# ---------------------------------------------------------------- санузел: X -2.3..-0.12, Y 1.25..2.6
def санузел(H):
    marble = img_mat("панели_санузла", "панели_санузла.png", 0.25)
    for name, (x1, y1, x2, y2), ax in (("панель_с", (-2.3, 2.585, -0.12, 2.6), "y"), ("панель_з", (-2.3, 1.25, -2.285, 2.6), "x"),
                                       ("панель_в", (-0.135, 1.25, -0.12, 2.6), "x"), ("панель_ю1", (-2.3, 1.25, -0.95, 1.265), "y"),
                                       ("панель_ю2", (-0.25, 1.25, -0.12, 1.265), "y")):
        p = box(name, x1, y1, 0.0, x2, y2, H - 0.02, marble, 0, None); uv_box(p, tile=1.0)
    brd = mat((0.3, 0.2, 0.15), 0.3)
    for (x1, y1, x2, y2) in ((-2.3, 2.58, -0.12, 2.585), (-2.285, 1.25, -2.28, 2.6), (-0.14, 1.25, -0.135, 2.6)):
        box("бордюр", x1, y1, 1.02, x2, y2, 1.06, brd, 0, None)
    for i in range(22):   # реечный потолок
        x = -2.3 + i * 0.1
        box("рейка", x, 1.25, H - 0.035, x + 0.098, 2.6, H - 0.02, mat((0.93, 0.93, 0.92), 0.25), 0.002, None)
    cyl("светильник_су", 0.12, H - 0.06, H - 0.035, -1.3, 1.9, emit_mat("плафон_су", (1, 0.97, 0.9), 1.5), 32)
    # полотенцесушитель на восточной стене (к шкафу): хромированная «лесенка», на нём полотенца
    chrome = flat_mat("хром_су", (0.9, 0.9, 0.92), 0.1, 1.0)
    for z in (0.95, 1.2, 1.45):
        tube("сушитель", [(-0.15, 1.6, z), (-0.2, 1.6, z), (-0.2, 2.1, z), (-0.15, 2.1, z)], 0.012, chrome, None, 0.03)
    tube("сушитель_стойка", [(-0.2, 1.6, 0.9), (-0.2, 1.6, 1.5)], 0.014, chrome, None)
    tube("сушитель_стойка", [(-0.2, 2.1, 0.9), (-0.2, 2.1, 1.5)], 0.014, chrome, None)
    stripe = img_mat("полотенце", "полотенце.png", 0.95, 0.4)
    t1 = box("полотенце_полосатое", -0.225, 1.65, 0.85, -0.185, 1.98, 1.47, stripe, 0, None); uv_box(t1, tile=0.6); soft(t1, 2, 0.015)
    t2 = box("полотенце_серое", -0.225, 1.98, 1.1, -0.185, 2.12, 1.47, mat((0.75, 0.75, 0.75), 0.95), 0, None); soft(t2, 2, 0.015)
    # зеркало со скруглённым верхним углом над раковиной на западной стене, светильник над ним
    pts = [(1.33, 1.05), (1.72, 1.05), (1.72, 1.45)]
    for i in range(1, 12):
        a = math.radians(90 * i / 11)
        pts.append((1.72 - 0.25 + 0.25 * math.cos(a), 1.45 + 0.25 * math.sin(a)))
    pts.append((1.33, 1.7))
    extrude2d("зеркало", pts, "yz", -2.285, -2.278, flat_mat("зеркало_су", (0.95, 0.95, 0.95), 0.02, 1.0), None, None, 0.002)
    box("светильник_зеркала", -2.285, 1.36, 1.78, -2.2, 1.7, 1.83, mat(PAL["белый"], 0.4), 0.008, None)
    box("лампа_зеркала", -2.24, 1.38, 1.775, -2.21, 1.68, 1.78, emit_mat("лампа_зеркала", (1, 0.97, 0.92), 3), 0, None)
    # вентиляция и трубы
    box("вентиляция", -0.6, 2.582, 2.2, -0.42, 2.585, 2.38, mat(PAL["белый"], 0.4), 0.003, None)
    for k in range(6):
        box("решётка", -0.59, 2.58, 2.215 + k * 0.027, -0.43, 2.582, 2.225 + k * 0.027, mat((0.6, 0.6, 0.6), 0.4), 0, None)
    tube("труба_су", [(-0.3, 2.55, 0.6), (-0.3, 2.55, 1.0), (-0.6, 2.55, 1.0)], 0.016, mat(PAL["белый"], 0.3), None, 0.04)

# ---------------------------------------------------------------- коридор
def в_коридоре():
    """Ещё обувь на полу и пакеты с бутылками у стены (фото коридора с мандарином)."""
    bag = glass_mat("пакет", (0.95, 0.95, 0.95), 0.45)
    for i, (x, y) in enumerate(((-0.25, 0.25), (-0.2, 0.5))):
        b = box("пакет", x - 0.15, y - 0.12, 0.0, x + 0.15, y + 0.12, 0.35 - i * 0.08, bag, 0, None); soft(b, 2, 0.06)
        for k in range(3):
            lathe("бутылка_в_пакете", [(0, 0), (0.03, 0), (0.03, 0.2), (0.012, 0.26), (0.012, 0.28)], mat(PAL["белый"] if k else PAL["голубой"], 0.3)).location = (x - 0.06 + k * 0.05, y, 0.01)

# ---------------------------------------------------------------- вид из окна — по OpenStreetMap
# Комната 11 на 3-м этаже восточной пластины общежития № 3 (Наличная 46 к1). Окно и лоджия смотрят
# на восток-юго-восток (≈106°): прямо напротив — 46 к2 (кирпичный, бирюзовый карниз), за ним деревья
# и Наличная улица, за дорогой 12-этажный кирпичный дом Наличная 55. Пол комнаты — на 7,5 м над землёй.
import json
UX = (0.961, -0.277)      # куда смотрит окно (восток, север)
UY = (0.277, 0.961)       # «влево», если стоять лицом к окну
WC = (52.55, -30.64)      # наружная плоскость стены с окном, середина комнаты — в метрах OSM

def to_room(e, n, L, W):
    dx, dy = e - WC[0], n - WC[1]
    return (L + 0.3 + dx * UX[0] + dy * UX[1], W / 2 + dx * UY[0] + dy * UY[1])

def _mesh(name, polys, m, uvtile=None):
    """polys: [([(x, y), ...], z1, z2)] — призмы, одним объектом."""
    import bmesh
    bm = bmesh.new()
    for pts, z1, z2 in polys:
        if len(pts) > 2 and pts[0] == pts[-1]: pts = pts[:-1]
        if len(pts) < 3: continue
        b = [bm.verts.new((x, y, z1)) for x, y in pts]; t = [bm.verts.new((x, y, z2)) for x, y in pts]
        try:
            bm.faces.new(t)
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((b[i], b[j], t[j], t[i]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(m)
    if uvtile: uv_box(ob, tile=uvtile)
    return ob

def вид(L, W, вечер=False):
    data = json.load(open(os.path.join(ROOT, "assets", "osm", "окрестности.json")))
    g = -7.5
    rnd = random.Random(5)
    brick = img_mat("фасад_кирпич", "фасад_кирпич.png", 0.85)
    pan = img_mat("фасад_панелька", "фасад_панелька_вечер.png" if вечер else "фасад_панелька.png", 0.9)
    if вечер:
        nt = pan.node_tree; bsdf = nt.nodes["Principled BSDF"]; t = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
        nt.links.new(t.outputs["Color"], bsdf.inputs["Emission Color"]); bsdf.inputs["Emission Strength"].default_value = 0.4
    plain = mat((0.78, 0.74, 0.66), 0.85)
    glassy = mat((0.25, 0.4, 0.45), 0.15)
    groups = {"кирпич": [], "панель": [], "прочее": [], "стекло": []}
    for bid, b in data["buildings"].items():
        t = b["t"]
        if b.get("rel") == "15608981" or bid in ("308929944", "16956114"): continue   # само общежитие
        pts = [to_room(x, y, L, W) for x, y in b["p"]]
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if cx < L + 2 or math.hypot(cx, cy) > 420: continue          # только то, что видно из окна
        try: h = float(t.get("height") or 0) or float(t.get("building:levels") or 1) * 3.0
        except ValueError: h = 3.0
        try: h0 = float(t.get("min_height") or 0)
        except ValueError: h0 = 0.0
        if bid == "85426979": h = 8.4                                # 46 к2: два высоких этажа и цоколь
        kind = t.get("building") or t.get("building:part")
        if t.get("building:material") == "glass": grp = "стекло"
        elif kind in ("apartments", "dormitory", "residential"): grp = "панель"
        elif kind in ("school", "office") or t.get("building:material") == "brick" or t.get("building:cladding") == "brick": grp = "кирпич"
        else: grp = "прочее"
        groups[grp].append((pts, g + h0, g + h))
    _mesh("дома_кирпич", groups["кирпич"], brick, 9.0)
    _mesh("дома_панель", groups["панель"], pan, 12.0)
    _mesh("дома_прочие", groups["прочее"], plain, 6.0)
    _mesh("дома_стекло", groups["стекло"], glassy, 6.0)
    # 46 к2 — бирюзовый карниз и кирпичные столбики на парапете, как на фото с вороной
    k2 = [to_room(x, y, L, W) for x, y in data["buildings"]["85426979"]["p"]]
    teal = mat((0.08, 0.42, 0.4), 0.45); dark_brick = mat((0.45, 0.2, 0.12), 0.85)
    xs = [p[0] for p in k2]; ys = [p[1] for p in k2]
    x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    box("карниз_46к2", x1 - 0.4, y1 - 0.4, g + 8.0, x1 + 0.6, y2 + 0.4, g + 8.4, teal, 0.02, None)
    for yy in [y1 + i * 4.5 for i in range(int((y2 - y1) / 4.5) + 1)]:
        box("столбик", x1 - 0.1, yy - 0.3, g + 8.4, x1 + 0.5, yy + 0.3, g + 9.2, dark_brick, 0, None)
        box("колпак", x1 - 0.15, yy - 0.35, g + 9.2, x1 + 0.55, yy + 0.35, g + 9.3, teal, 0.01, None)
    box("парапет_46к2", x1, y1, g + 8.4, x1 + 0.35, y2, g + 8.9, dark_brick, 0, None)
    box("парапет_колпак", x1 - 0.05, y1, g + 8.9, x1 + 0.4, y2, g + 8.98, teal, 0, None)
    # дороги: полосы по осям OSM
    asphalt = mat((0.2, 0.2, 0.21), 0.9); walk = mat((0.45, 0.44, 0.42), 0.9)
    widths = {"primary": 18, "secondary": 16, "tertiary": 12, "residential": 7, "service": 4.5, "living_street": 5,
              "footway": 2.2, "path": 1.8, "pedestrian": 4, "cycleway": 2}
    road_polys = {"асфальт": [], "тротуар": []}
    for r in data["roads"].values():
        w = widths.get(r["kind"])
        if not w: continue
        P = [to_room(x, y, L, W) for x, y in r["p"]]
        if all(p[0] < L or math.hypot(*p) > 420 for p in P): continue
        for (ax, ay), (bx, by) in zip(P, P[1:]):
            dx, dy = bx - ax, by - ay; ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln * w / 2, dx / ln * w / 2
            q = [(ax + nx, ay + ny), (bx + nx, by + ny), (bx - nx, by - ny), (ax - nx, ay - ny)]
            road_polys["тротуар" if w < 3 else "асфальт"].append((q, g + 0.01 + (0.005 if w < 3 else 0), g + 0.02 + (0.005 if w < 3 else 0)))
    _mesh("дороги", road_polys["асфальт"], asphalt)
    _mesh("тротуары", road_polys["тротуар"], walk)
    box("земля", L + 0.3, -450, g - 0.1, 500, 450, g, mat((0.27, 0.33, 0.2), 0.95), 0, None)
    # деревья: из OSM и рядами вдоль Наличной (ели и лиственные), как на фото
    spots = [to_room(x, y, L, W) for x, y in data["trees"]]
    for r in data["roads"].values():
        if r["name"] == "Наличная улица":
            P = [to_room(x, y, L, W) for x, y in r["p"]]
            for (ax, ay), (bx, by) in zip(P, P[1:]):
                ln = math.hypot(bx - ax, by - ay)
                for k in range(int(ln / 9)):
                    f = (k + rnd.random() * 0.5) / max(1, ln / 9)
                    px, py = ax + (bx - ax) * f, ay + (by - ay) * f
                    off = rnd.choice((-1, 1)) * rnd.uniform(11, 16)
                    nx, ny = -(by - ay) / ln, (bx - ax) / ln
                    spots.append((px + nx * off, py + ny * off))
    ствол = mat((0.25, 0.2, 0.15), 0.9)
    for (x, y) in spots:
        if x < L + 8 or math.hypot(x, y) > 380: continue
        h = rnd.uniform(7, 13)
        cyl("ствол", 0.2, g, g + h * 0.4, x, y, ствол, 8)
        if rnd.random() < 0.45:   # ель
            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=h * 0.22, radius2=0, depth=h * 0.85, location=(x, y, g + h * 0.55))
            tr = bpy.context.object; tr.data.materials.append(mat((0.07, 0.2, 0.1), 0.9))
        else:
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=h * 0.3, location=(x, y, g + h * 0.72))
            tr = bpy.context.object; tr.scale = (1, 1, 1.15)
            tr.data.materials.append(mat((0.13 + rnd.uniform(0, 0.08), 0.28 + rnd.uniform(0, 0.1), 0.1), 0.9))
        tr.name = "крона"
    # фонари во дворе 46 к2, как на фото из окна
    for (x, y) in ((L + 14, W / 2 - 4), (L + 14, W / 2 + 18)):
        cyl("фонарь", 0.08, g, g + 8, x, y, mat((0.4, 0.4, 0.42), 0.4), 10)
        box("фонарь_голова", x - 0.4, y - 0.15, g + 8, x + 0.4, y + 0.15, g + 8.12, mat((0.6, 0.6, 0.6), 0.4), 0.02, None)
