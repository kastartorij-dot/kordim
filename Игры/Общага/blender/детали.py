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
    # корпус: «восьмёрка» — нижний и верхний овалы с талией, контур в плоскости xz, толщина по y
    def half(zz):
        lw = 0.19 * math.sqrt(max(0.0, 1 - ((zz - 0.2) / 0.18) ** 2))
        uw = 0.145 * math.sqrt(max(0.0, 1 - ((zz - 0.47) / 0.13) ** 2))
        return max(lw, uw, 0.0)
    zs = [0.02 + 0.58 * k / 40 for k in range(41)]
    right = [(max(half(zz), 0.004), zz) for zz in zs]
    body = right + [(-xx, zz) for xx, zz in reversed(right)]
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

def у_стола(ширина):
    # стол стоит в (1.875, 0) повёрнут на 180: локальные x → X = 1.875 − x, y → Y = −y
    box("коврик_мыши", 1.875 - 0.32, 0.27, 0.75, 1.875 - 0.04, 0.5, 0.753, mat((0.25, 0.45, 0.12), 0.7), 0.003, None)
    микрофон(1.875 + 0.41, 0.25, 0.75)
    # Лента на передней и задней кромках, с продолжением к щиту кровати.
    red = emit_mat("лента_стол", (1.0, 0.08, 0.15), 5)
    left, right = 1.875 - ширина / 2, 1.875 + ширина / 2
    box("лента_стол_перед", left, 0.620, 0.731, right, 0.627, 0.740, red, 0, None)
    box("лента_стол_сзади", left, 0.002, 0.746, right, 0.01, 0.754, red, 0, None)
    box("лента_к_кровати", right, 0.002, 0.746, 2.65, 0.01, 0.754, red, 0, None)

# ---------------------------------------------------------------- сложенная доска за шторой
def гладильная_доска(L):
    """Уточнение автора: посторонняя коробка/табличка убраны, доска стоит за тканью.

    Форма — узкий округлый нос, тканевый чехол, тонкий обод и сложенные ножки.
    Не выдаём прежние коробки за референс гладильной доски.
    """
    root = empty("Гладильная_доска", (L - 0.04, 0.26, 0.025))
    cover = flat_mat("чехол_доски", (0.35, 0.43, 0.44), 0.92)
    from материалы import normal_map
    normal_map(cover, "ткань_normal.png", 0.6)
    pts = [(-0.16, 0), (0.16, 0), (0.16, 0.82)]
    pts += [(0.16 * math.cos(a), 0.82 + 0.38 * math.sin(a))
            for a in [i * math.pi / 24 for i in range(1, 25)]]
    extrude2d("доска_чехол", pts, "yz", -0.015, 0.008, cover, root, "z", 0.008)
    metal = flat_mat("ножки_доски", (0.55, 0.58, 0.58), 0.45, 0.65)
    for side in (-1, 1):
        tube("сложенная_ножка", [(0.035, side * 0.10, 0.06),
             (0.04, side * 0.07, 0.54), (0.035, side * 0.09, 0.92)],
             0.008, metal, root, 0.025)
    root.rotation_euler.y = math.radians(-2)
    return root

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
    cyl("светильник_су", 0.12, H - 0.06, H - 0.035, -1.3, 1.9, emit_mat("плафон_су", (1, 0.97, 0.9), 4), 32)
    bpy.ops.object.light_add(type="AREA", location=(-1.3, 1.9, H - 0.08))   # в санузле окна нет — свет горит всегда
    l = bpy.context.object; l.data.shape = "DISK"; l.data.size = 0.25; l.data.energy = 70; l.data.color = (1, 0.95, 0.88)
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
# и Наличная улица, за дорогой 12-этажный кирпичный дом Наличная 55. Пол комнаты — на 10 м над землёй.
import json
from окружение import VIEW, to_room, building_span, building_kind, is_own_building

def _mesh(name, polys, m, uvtile=None, roof=None):
    """polys: [([(x, y), ...], z1, z2)] — призмы, одним объектом."""
    import bmesh
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify() if uvtile else None
    for pts, z1, z2 in polys:
        if len(pts) > 2 and pts[0] == pts[-1]: pts = pts[:-1]
        if len(pts) < 3: continue
        b = [bm.verts.new((x, y, z1)) for x, y in pts]; t = [bm.verts.new((x, y, z2)) for x, y in pts]
        try:
            top = bm.faces.new(t)
            if roof: top.material_index = 1
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                face = bm.faces.new((b[i], b[j], t[j], t[i]))
                if uv:
                    # Развёртка вдоль стены и вверх: этажи остаются горизонтальными
                    # и на повёрнутых контурах. На крышу текстура окон не идёт.
                    length = math.dist(pts[i], pts[j])
                    coords = ((0, 0), (length / uvtile, 0),
                              (length / uvtile, (z2 - z1) / uvtile), (0, (z2 - z1) / uvtile))
                    for loop, coord in zip(face.loops, coords): loop[uv].uv = coord
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(m)
    if roof: ob.data.materials.append(roof)
    return ob

def кладка(name, color, seam):
    """Тайловая карта из четырёх рядов со смещённым швом, встроенная в GLB."""
    image = bpy.data.images.new(name, width=128, height=64, alpha=False)
    pixels = []
    for y in range(64):
        row = y // 16
        for x in range(128):
            column, distance = divmod((x + (16 if row % 2 else 0)) % 128, 32)
            multiplier = 0.94 + ((column * 5 + row * 3) % 7) * 0.02
            rgb = seam if y % 16 == 0 or distance == 0 else [c * multiplier for c in color]
            pixels.extend((*rgb, 1))
    image.pixels.foreach_set(pixels)
    image.pack()
    material = mat(color, 0.95)
    nodes = material.node_tree.nodes
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = image
    material.node_tree.links.new(texture.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    return material


def лавка(x, y, ground, angle, wood, metal):
    root = empty("лавка_двора", (x, y, ground))
    root.rotation_euler.z = angle
    for slat in range(4):
        edge = -0.26 + slat * 0.13
        box("лавка_сиденье", edge, -0.9, 0.44, edge + 0.105, 0.9, 0.48, wood, 0.006, None, root)
    for h in (0.59, 0.73, 0.87):
        box("лавка_спинка", 0.27, -0.9, h, 0.31, 0.9, h + 0.10, wood, 0.008, None, root)
    for end in (-0.66, 0.66):
        tube("лавка_опора", [(-0.28, end, 0), (-0.12, end, 0.44),
                             (0.20, end, 0.44), (0.34, end, 0.97)], 0.027, metal, root)


def двор(g, facade_x):
    """Сквозной проход, зелёная полоса и ворота по панорамам автора."""
    paving = кладка("брусчатка_двора", (0.48, 0.49, 0.48), (0.37, 0.38, 0.37))
    curb = mat((0.55, 0.53, 0.48), 0.95)
    soil = mat((0.19, 0.15, 0.10), 1.0)
    metal = mat((0.037, 0.12, 0.092), 0.7)
    grass = mat((0.15, 0.24, 0.09), 0.95)
    hedge = mat((0.07, 0.17, 0.045), 0.95)
    tile = box("покрытие_двора", 6.3, -27.5, g, facade_x - 4.0, 34, g + 0.046, paving, 0, None)
    uv_box(tile, tile=0.76)
    approach = box("подход_к_правым_воротам", facade_x - 4.0, -27.5, g, 49, -21, g + 0.046, paving, 0, None)
    uv_box(approach, tile=0.76)
    asphalt = mat((0.19, 0.20, 0.20), 0.96)
    box("проезд_за_правой_оградой", 6.3, -35, g, 55, -27.5, g + 0.04, asphalt, 0, None)
    box("газон_у_корпуса", facade_x - 4.0, -17, g, facade_x, 28.2, g + 0.10, grass, 0, None)
    box("бордюр_газона", facade_x - 4.05, -17, g, facade_x - 3.95, 28.2, g + 0.14, curb, 0.005, None)
    for y in (-12, -7, -2, 3, 16, 21, 25):
        x = facade_x - 5.5
        box("вазон", x - 0.54, y - 0.54, g + 0.046, x + 0.54, y + 0.54, g + 0.38, curb, 0.025, None)
        box("земля_вазона", x - 0.44, y - 0.44, g + 0.379, x + 0.44, y + 0.44, g + 0.385, soil, 0, None)
    for y in (*range(-16, 6, 2), *range(12, 27, 2)):
        x = facade_x - 3.1
        box("живая_изгородь", x - 0.38, y, g + 0.14, x + 0.38, y + 1.77, g + 0.94, hedge, 0.14, None)

    # Пара лавок стоит напротив входа, левее прямого вида из комнаты.
    entrance_y = 8.0
    pocket = box("карман_под_лавками", facade_x - 4.03, entrance_y - 2.25, g + 0.09,
                 facade_x - 2.55, entrance_y + 3.8, g + 0.105, paving, 0, None)
    uv_box(pocket, tile=0.76)
    bench_wood = mat((0.18, 0.105, 0.062), 0.84)
    bench_green = mat((0.07, 0.23, 0.13), 0.82)
    x = facade_x - 3.25
    лавка(x, entrance_y - 1.15, g + 0.10, -math.pi / 2, bench_green, metal)
    лавка(x, entrance_y + 1.65, g + 0.10, math.pi / 2, bench_green, metal)
    лавка(facade_x - 4.45, entrance_y + 6.3, g + 0.046, 0, bench_wood, metal)
    bin_yellow = mat((0.61, 0.42, 0.12), 0.9)
    for y in (entrance_y - 2.0, entrance_y + 2.95):
        x = facade_x - 4.1
        box("урна_жёлтая", x - 0.22, y - 0.22, g + 0.046, x + 0.22, y + 0.22, g + 0.59, bin_yellow, 0.018, None)
        box("урна_верх", x - 0.18, y - 0.18, g + 0.587, x + 0.18, y + 0.18, g + 0.593, metal, 0, None)

    fence_x = facade_x - 1.95
    for h in (0.26, 0.97):
        box("садовая_ограда", fence_x - 0.025, -16, g + h, fence_x + 0.025, 27, g + h + 0.035, metal, 0, None)
    for i in range(139):
        y = -16 + 0.31 * i
        box("садовая_ограда_прут", fence_x - 0.013, y - 0.013, g + 0.11, fence_x + 0.013, y + 0.013, g + 1.05, metal, 0, None)

    for y in (-27.5, 33):
        for x1, x2 in ((6.3, 10.4), (11, 13.8), (13.8, 16.6), (18.6, facade_x)):
            for h in (0.30, 1.45):
                box("ограда_перекладина", x1, y - 0.025, g + h, x2, y + 0.025, g + h + 0.04, metal, 0, None)
            count = round((x2 - x1) / 0.19)
            for i in range(count + 1):
                x = x1 + (x2 - x1) * i / count
                box("ограда_прут", x - 0.012, y - 0.012, g + 0.08, x + 0.012, y + 0.012, g + 1.67, metal, 0, None)
        for x in (10.7, 16.9, 18.3):
            box("кирпичный_столб_ворот", x - 0.32, y - 0.32, g, x + 0.32, y + 0.32, g + 1.78, curb, 0, None)
            box("колпак_ворот", x - 0.37, y - 0.37, g + 1.78, x + 0.37, y + 0.37, g + 1.88, metal, 0.025, None)

    trunk = mat((0.16, 0.11, 0.072), 0.95)
    needles = mat((0.075, 0.17, 0.10), 0.95)
    for y, height in ((-13.2, 6.4), (-8.8, 5.0), (14.5, 4.8)):
        x = facade_x - 2.2
        cyl("ель_ствол", 0.11, g, g + height * 0.8, x, y, trunk, 10)
        for tier in range(6):
            radius = height * (0.26 - tier * 0.038)
            bpy.ops.mesh.primitive_cone_add(vertices=13, radius1=radius, depth=height * 0.33,
                                            location=(x, y, g + height * (0.31 + tier * 0.105)))
            branch = bpy.context.object
            branch.name = "ель_ветви"
            branch.rotation_euler.z = tier * 0.33
            branch.data.materials.append(needles)


def вид(L, W, вечер=False):
    data = json.load(open(os.path.join(ROOT, "assets", "osm", "окрестности.json")))
    g = -VIEW["floor_height_m"]
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
        if is_own_building(bid, b): continue
        pts = [to_room(x, y, L, W) for x, y in b["p"]]
        cx = sum(p[0] for p in pts) / len(pts); cy = sum(p[1] for p in pts) / len(pts)
        if cx < L + 2 or math.hypot(cx - L, cy - W / 2) > VIEW["range_m"]: continue
        z1, z2 = building_span(bid, t)
        if z2 <= z1: continue
        if bid == "85426979":
            brick_k2 = кладка("кирпич_46к2", (0.51, 0.36, 0.26), (0.44, 0.35, 0.27))
            _mesh("корпус_46к2", [(pts, z1, z2)], brick_k2, 0.76, mat((0.20, 0.23, 0.23), 0.9))
            # Два ряда высоких окон, светлый кирпич и тёмные обрамления по F18/F20.
            frame_mat = mat((0.35, 0.16, 0.12), 0.85)
            pane_mat = mat((0.055, 0.11, 0.125), 0.35)
            bar_mat = mat((0.08, 0.30, 0.26), 0.55)
            area = sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(pts,pts[1:]+pts[:1]))
            for a,b in zip(pts, pts[1:]+pts[:1]):
                dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy)
                if length < 2.5: continue
                nx,ny=(dy/length,-dx/length) if area > 0 else (-dy/length,dx/length)
                count=max(1,round(length/4.2))
                for i in range(count):
                    f=(i+0.5)/count; xx=a[0]+dx*f; yy=a[1]+dy*f
                    width = min(2.56 if i % 3 != 1 else 2.20, length / count - 0.35)
                    for bottom in (g+1.28,g+4.68):
                        frame = empty("оконный_блок_46к2", (xx, yy, bottom))
                        frame.rotation_euler.z = math.atan2(dy, dx)
                        outside = -1 if area > 0 else 1
                        box("стекло_46к2", -width/2, 0, 0, width/2, outside*0.085, 1.65, pane_mat, 0, None, frame)
                        for j in range(4):
                            x = width * (j / 3 - 0.5)
                            box("вертикаль_рамы", x-0.038, outside*0.08, 0, x+0.038, outside*0.16, 1.65, bar_mat, 0, None, frame)
                        for z in (0.0, 1.11, 1.58):
                            box("перемычка_рамы", -width/2, outside*0.09, z, width/2, outside*0.17, z+0.07, bar_mat, 0, None, frame)
                        box("отлив_46к2", -width/2-0.10, 0, -0.045, width/2+0.10, outside*0.22, 0.025, bar_mat, 0, None, frame)
                        box("кирпичная_перемычка", -width/2-0.20, 0, 1.69, width/2+0.20, outside*0.075, 1.90, frame_mat, 0, None, frame)
        elif bid == "16237661":
            _mesh("дом_55_светлый", [(pts,z1,z2)], pan, 9, mat((0.24,0.25,0.25),0.9))
        else:
            groups[building_kind(t)].append((pts, z1, z2))
    roof = mat((0.22, 0.24, 0.24), 0.95)
    _mesh("дома_кирпич", groups["кирпич"], brick, 9.0, roof)
    _mesh("дома_панель", groups["панель"], pan, 12.0, roof)
    _mesh("дома_прочие", groups["прочее"], plain, 6.0, roof)
    _mesh("дома_стекло", groups["стекло"], glassy, 6.0, roof)
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
    двор(g, x1)
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
        # Ближний план заменён готовыми CC0-деревьями в Godot; здесь только дальний LOD.
        if math.hypot(x - L, y - W / 2) < 65: continue
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
    for (x, y) in ((x1 - 5.3, -6), (x1 - 5.3, 15)):
        pole = mat((0.25, 0.27, 0.27), 0.55)
        cyl("фонарь", 0.08, g, g + 6.2, x, y, pole, 10)
        tube("кронштейн_фонаря", [(x, y, g + 6.08), (x - 0.22, y, g + 6.25),
                                  (x - 0.58, y, g + 6.28)], 0.036, pole)
        box("фонарь_голова", x - 0.78, y - 0.12, g + 6.23, x - 0.38, y + 0.12, g + 6.34, pole, 0.025, None)
