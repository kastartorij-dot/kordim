# Процедурная модель Бизнес-центра «Асгард» (Наличная ул., 44 к1 с1, OSM ID: r7641833_308929943).
# Класть в папку blender/ рядом с детали.py.
#
# Подключение в blender/детали.py:
#   1) В начале файла добавить:
#        from асгард import бц_асгард
#   2) В функции вид(L, W, вечер=False) внутри цикла по buildings (после проверки "85426983"
#      или перед веткой elif bid == "16237661":) добавить:
#        if bid == "r7641833_308929943":
#            бц_асгард(pts, g, вечер)
#            continue

import bmesh
import bpy
import math
import os
from мебель import ROOT
from мелочь import mat

TEX = os.path.join(ROOT, "textures")

# Габариты реального 9-этажного здания (~32–33 м), совпадающие с панорамой со двора
H_PLINTH = 4.10       # 1-й этаж (песчаниковый цоколь + витражи)
FLOOR_H = 3.45        # высота типового офисного этажа (2–9 этажи)
OFFICE_FLOORS = 8
H_MAIN = H_PLINTH + OFFICE_FLOORS * FLOOR_H  # 31.70 м
H_PARAPET = H_MAIN + 0.60                    # 32.30 м
H_CORNICE_BOT = H_MAIN - 1.10                  # 30.60 м
H_CORNICE_TOP = H_MAIN + 0.72                  # 32.42 м

# Зонирование 24-вершинного контура r7641833_308929943 из assets/osm/окрестности.json:
# 0..6 — северный торец (смотрит на общагу), 7..15 — восточный фасад (Наличная ул.),
# 16..22 — южный торец, 23 — западный дворовый фасад.
GLASS_EDGES = {5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17}
BALCONY_EDGES = {4, 18}
CORNICE_GROUPS = (
    (6, 7),    # северный угловой ризалит (виден из окна общаги)
    (11,),     # центральный ризалит вдоль Наличной
    (15, 16),  # южный угловой ризалит
)
NORTH_BEIGE_EDGES = {0, 2}
STREET_PLINTH_EDGES = {0, 2, 6, 7, 9, 11, 13, 15, 16}


def _tex_mat(name, filename, rough=0.5, metallic=0.0, evening=False, emit_strength=0.40):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    path = os.path.join(TEX, filename)
    if os.path.exists(path):
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(path, check_existing=True)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if evening:
            nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
            bsdf.inputs["Emission Strength"].default_value = emit_strength
    else:
        # Запасной цвет, если текстуры ещё не сгенерированы
        bsdf.inputs["Base Color"].default_value = (0.18, 0.36, 0.44, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    return m


def _prism_batch(name, polys, material):
    """Создаёт один меш из списка призм [(pts, z1, z2), ...]."""
    if not polys:
        return None
    bm = bmesh.new()
    for pts, z1, z2 in polys:
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]
        if len(pts) < 3 or z2 <= z1:
            continue
        bot = [bm.verts.new((x, y, z1)) for x, y in pts]
        top = [bm.verts.new((x, y, z2)) for x, y in pts]
        try:
            bm.faces.new(list(reversed(bot)))
            bm.faces.new(top)
            for i in range(len(pts)):
                j = (i + 1) % len(pts)
                bm.faces.new((bot[i], bot[j], top[j], top[i]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob


def _edge_quad(a, vx, vy, nx, ny, start, finish, d_in, d_out):
    return [
        (a[0] + vx * start + nx * d_in, a[1] + vy * start + ny * d_in),
        (a[0] + vx * finish + nx * d_in, a[1] + vy * finish + ny * d_in),
        (a[0] + vx * finish + nx * d_out, a[1] + vy * finish + ny * d_out),
        (a[0] + vx * start + nx * d_out, a[1] + vy * start + ny * d_out),
    ]


def бц_асгард(footprint, g, вечер=False):
    """Строит детализированную модель БЦ «Асгард» по контуру OSM."""
    pts = footprint[:-1] if len(footprint) > 2 and footprint[0] == footprint[-1] else list(footprint)
    n = len(pts)
    if n < 3:
        return

    is_osm24 = (n == 24)
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))

    # Материалы
    glass_tex = "фасад_асгард_стекло_вечер.png" if вечер else "фасад_асгард_стекло.png"
    wall_tex = "фасад_асгард_стена_вечер.png" if вечер else "фасад_асгард_стена.png"
    glass_mat = _tex_mat("асгард_витраж", glass_tex, rough=0.16, metallic=0.22,
                         evening=вечер, emit_strength=0.42)
    wall_mat = _tex_mat("асгард_вентфасад", wall_tex, rough=0.84, metallic=0.0,
                        evening=вечер, emit_strength=0.35)
    roof_mat = mat((0.20, 0.22, 0.23), 0.94)
    sandstone = mat((0.68, 0.56, 0.40), 0.86)
    white_cornice = mat((0.88, 0.87, 0.84), 0.62)
    dark_metal = mat((0.14, 0.17, 0.20), 0.42)
    storefront_glass = mat((0.08, 0.14, 0.18), 0.18)
    beige_solid = mat((0.77, 0.73, 0.66), 0.85)
    hvac_mat = mat((0.52, 0.54, 0.55), 0.78)

    # 1. Цокольный первый этаж (песчаниковый камень)
    _prism_batch("асгард_цоколь", [(pts, g, g + H_PLINTH)], sandstone)

    # 2. Основной 8-этажный объём (2–9 этажи) с разделением материалов по граням и точной UV-сеткой
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    z1, z2 = g + H_PLINTH, g + H_MAIN
    bot = [bm.verts.new((x, y, z1)) for x, y in pts]
    top = [bm.verts.new((x, y, z2)) for x, y in pts]
    roof_face = bm.faces.new(top)
    roof_face.material_index = 2

    tile_w = 12.0
    tile_h = 4 * FLOOR_H  # 13.80 м -> 8 этажей ложатся ровно в 2.0 тайла без обрезки
    v_top = (z2 - z1) / tile_h

    for i in range(n):
        j = (i + 1) % n
        face = bm.faces.new((bot[i], bot[j], top[j], top[i]))
        is_glass = (i in GLASS_EDGES) if is_osm24 else True
        face.material_index = 0 if is_glass else 1
        length = math.dist(pts[i], pts[j])
        u_end = length / tile_w
        for loop, coord in zip(face.loops, ((0.0, 0.0), (u_end, 0.0), (u_end, v_top), (0.0, v_top))):
            loop[uv].uv = coord

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("асгард_корпус")
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("асгард_корпус", me)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(glass_mat)
    ob.data.materials.append(wall_mat)
    ob.data.materials.append(roof_mat)

    # 3. Архитектурные детали: карнизы-козырьки, балконы, пилястры цоколя, парапеты
    parts = {
        "белый_карниз": (white_cornice, []),
        "тёмный_металл": (dark_metal, []),
        "витрина_1эт": (storefront_glass, []),
        "песчаник_колонны": (sandstone, []),
        "беж_детали": (beige_solid, []),
    }

    def edge_frame(i):
        a = pts[i]
        b = pts[(i + 1) % n]
        length = math.dist(a, b)
        vx, vy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        nx, ny = (vy, -vx) if area > 0 else (-vy, vx)
        return a, b, length, vx, vy, nx, ny

    # Межэтажный тёмный пояс на стыке 1-го и 2-го этажей + парапет по периметру
    cornice_edge_set = {e for grp in CORNICE_GROUPS for e in grp} if is_osm24 else set()
    for i in range(n):
        a, b, length, vx, vy, nx, ny = edge_frame(i)
        if length < 0.5:
            continue
        # Тёмный отлив между цоколем и 2-м этажом
        q_band = _edge_quad(a, vx, vy, nx, ny, -0.05, length + 0.05, -0.05, 0.14)
        parts["тёмный_металл"][1].append((q_band, g + H_PLINTH - 0.14, g + H_PLINTH + 0.06))

        # Парапет кровли там, где нет массивного белого козырька
        if i not in cornice_edge_set:
            q_par = _edge_quad(a, vx, vy, nx, ny, -0.05, length + 0.05, -0.35, 0.08)
            target = "тёмный_металл" if (is_osm24 and i in GLASS_EDGES) else "беж_детали"
            parts[target][1].append((q_par, g + H_MAIN, g + H_PARAPET))

        # Витрины 1-го этажа и песчаниковые пилоны вдоль видимых фасадов
        if (not is_osm24) or (i in STREET_PLINTH_EDGES):
            q_gl = _edge_quad(a, vx, vy, nx, ny, 0.35, length - 0.35, 0.0, 0.06)
            parts["витрина_1эт"][1].append((q_gl, g + 0.45, g + H_PLINTH - 0.35))
            cols = max(2, round(length / 4.8) + 1)
            for k in range(cols):
                pos = 0.35 + (length - 0.70) * k / (cols - 1)
                q_col = _edge_quad(a, vx, vy, nx, ny, pos - 0.36, pos + 0.36, -0.05, 0.16)
                parts["песчаник_колонны"][1].append((q_col, g, g + H_PLINTH - 0.14))

        # Тонкие угловые и фасадные вертикальные стойки на стеклянных гранях
        if is_osm24 and i in GLASS_EDGES and length >= 8.0:
            for pos in (0.12, length - 0.12):
                q_fin = _edge_quad(a, vx, vy, nx, ny, pos - 0.10, pos + 0.10, -0.04, 0.14)
                parts["тёмный_металл"][1].append((q_fin, g + H_PLINTH, g + H_MAIN))

        # Объёмные горизонтальные пояски-отливы на северной бежевой части (видна из окна)
        if is_osm24 and i in NORTH_BEIGE_EDGES:
            for lvl in range(OFFICE_FLOORS):
                z_sill = g + H_PLINTH + lvl * FLOOR_H + 0.92
                q_sill = _edge_quad(a, vx, vy, nx, ny, 0.25, length - 0.25, 0.0, 0.12)
                parts["беж_детали"][1].append((q_sill, z_sill - 0.06, z_sill + 0.04))

    # Три массивных белых выступающих карниза-козырька на крыше (фирменная деталь БЦ «Асгард»)
    if is_osm24:
        overhang = 0.74
        for grp in CORNICE_GROUPS:
            for idx_in_grp, edge_idx in enumerate(grp):
                a, b, length, vx, vy, nx, ny = edge_frame(edge_idx)
                # Продлеваем на величину вылета в угловой точке стыка двух граней ризалита
                ext_start = overhang if idx_in_grp > 0 else 0.18
                ext_end = overhang if idx_in_grp < len(grp) - 1 else 0.18
                q_box = _edge_quad(a, vx, vy, nx, ny, -ext_start, length + ext_end, -0.65, overhang)
                parts["белый_карниз"][1].append((q_box, g + H_CORNICE_BOT, g + H_CORNICE_TOP))
                # Тёмный теневой подшив снизу козырька
                q_sof = _edge_quad(a, vx, vy, nx, ny, -ext_start + 0.05, length + ext_end - 0.05,
                                   -0.10, overhang - 0.08)
                parts["тёмный_металл"][1].append((q_sof, g + H_CORNICE_BOT - 0.10, g + H_CORNICE_BOT))

        # Колонки открытых белых балконов в нишах северного (4) и южного (18) торцов
        for b_edge in BALCONY_EDGES:
            a, b, length, vx, vy, nx, ny = edge_frame(b_edge)
            balcony_depth = 1.68
            # 6 открытых балконов на 3–8 этажах (как на фото фасадов)
            for lvl in range(1, 7):
                z0 = g + H_PLINTH + lvl * FLOOR_H
                # Консольная белая плита балкона
                q_slab = _edge_quad(a, vx, vy, nx, ny, 0.02, length - 0.02, -0.10, balcony_depth)
                parts["белый_карниз"][1].append((q_slab, z0 - 0.20, z0 + 0.04))
                # Передний парапет ограждения
                q_front = _edge_quad(a, vx, vy, nx, ny, 0.04, length - 0.04,
                                     balcony_depth - 0.14, balcony_depth)
                parts["белый_карниз"][1].append((q_front, z0 + 0.04, z0 + 1.04))
                # Боковые щёчки ограждения
                for s0, s1 in ((0.04, 0.18), (length - 0.18, length - 0.04)):
                    q_side = _edge_quad(a, vx, vy, nx, ny, s0, s1, 0.0, balcony_depth)
                    parts["белый_карниз"][1].append((q_side, z0 + 0.04, z0 + 1.04))
                # Тёмный металлический поручень сверху
                q_rail = _edge_quad(a, vx, vy, nx, ny, 0.02, length - 0.02,
                                    balcony_depth - 0.16, balcony_depth + 0.02)
                parts["тёмный_металл"][1].append((q_rail, z0 + 1.04, z0 + 1.11))

    for suffix, (material, geometry) in parts.items():
        _prism_batch(f"асгард_{suffix}", geometry, material)

    # 4. Технические надстройки (венткамеры) в глубине кровли
    cx = sum(p[0] for p in pts) / n
    cy = sum(p[1] for p in pts) / n
    if is_osm24:
        _, _, _, ux, uy, _, _ = edge_frame(7)   # вдоль длинной оси здания (С–Ю)
        _, _, _, wx, wy, _, _ = edge_frame(6)   # поперёк (З–В)
    else:
        ux, uy, wx, wy = 1.0, 0.0, 0.0, 1.0

    hvac_polys = []
    for offset_u, offset_w, half_u, half_w, height in (
        (-16.0, -2.0, 5.5, 3.2, 2.3),
        (14.0, -2.0, 6.0, 3.2, 2.3),
    ):
        px = cx + ux * offset_u + wx * offset_w
        py = cy + uy * offset_u + wy * offset_w
        quad = [
            (px - ux * half_u - wx * half_w, py - uy * half_u - wy * half_w),
            (px + ux * half_u - wx * half_w, py + uy * half_u - wy * half_w),
            (px + ux * half_u + wx * half_w, py + uy * half_u + wy * half_w),
            (px - ux * half_u + wx * half_w, py - uy * half_u + wy * half_w),
        ]
        hvac_polys.append((quad, g + H_MAIN, g + H_MAIN + height))
    _prism_batch("асгард_кровля_тех", hvac_polys, hvac_mat)