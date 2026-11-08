"""Арт-дирекшн Порта поверх Pixel Snapper: общая палитра + общий размер пикселя.

Отличия от pixel_snap.snap:
- размер пикселя задаётся не автоопределением, а целевым разрешением категории
  (фон — ширина N клеток, портрет — ширина M клеток), сетка всё равно липнет к краям;
- цвета картинки (k-means) сводятся к общей палитре по перцептивной разнице (CIELAB),
  и уже потом каждая клетка голосует за свой итоговый цвет.
"""
import numpy as np
from PIL import Image
import pixel_snap as ps

PALETTES = {
    # Ручная: свеча и огонь против холодного прилива; тени уходят в сливу, не в чёрный
    'svecha': ('Свеча и прилив', [
        '0e0b0d', '1b1520', '2a2230', '3d3240',             # тени, сливовые
        '432a1c', '5e3d26', '7d5535', 'a0714a',             # дерево
        'c8873f', 'e3a857', 'f3cf86', 'fff0c4',             # свеча, блик
        '8a2f23', 'b8492c',                                 # огонь, кирпич
        '6e4636', '9c6550', 'c48a6d', 'e2b394',             # кожа
        '5a1f2c', '8c3443',                                 # вино, ткань
        '2e3a2a', '4f5e3b',                                 # зелень, сукно
        '141c2e', '1f2e47', '34496a', '51698c', '7d93ae', 'b4c2cf',  # ночь, море
        '2f5a5e',                                           # бирюза воды
        '4a4744', '6f6a63', 'd0c8b8',                       # камень, туман
    ]),
    # Endesga 32 — популярная общая палитра пиксельщиков, как контрольный образец
    'endesga': ('Endesga 32 (общая)', [
        'be4a2f', 'd77643', 'ead4aa', 'e4a672', 'b86f50', '733e39', '3e2731', 'a22633',
        'e43b44', 'f77622', 'feae34', 'fee761', '63c74d', '3e8948', '265c42', '193c3e',
        '124e89', '0099db', '2ce8f5', 'ffffff', 'c0cbdc', '8b9bb4', '5a6988', '3a4466',
        '262b44', '181425', 'ff0044', '68386c', 'b55088', 'f6757a', 'e8b796', 'c28569',
    ]),
}


def hex2rgb(h):
    return np.array([[int(x[i:i + 2], 16) for i in (0, 2, 4)] for x in h], np.uint8)


def rgb2lab(rgb):
    c = rgb.astype(np.float64) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722],
                        [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]),
                     200 * (f[..., 1] - f[..., 2])], -1)


def data_palette(paths, k=32, seed=7):
    """Палитра «как есть»: k-means по выборке пикселей всех картинок."""
    rng = np.random.default_rng(seed)
    px = []
    for p in paths:
        a = np.asarray(Image.open(p).convert('RGB').resize((160, 120))).reshape(-1, 3)
        px.append(a[rng.choice(len(a), 1500, replace=False)])
    px = np.concatenate(px)[None]
    _, _, pal = ps.quantize(px, k, seed, 30)
    lab = rgb2lab(pal)
    order = np.lexsort((lab[:, 2], lab[:, 0]))
    return ['%02x%02x%02x' % tuple(c) for c in pal[order]]


def to_palette(pal_local, pal_global):
    a, b = rgb2lab(pal_local), rgb2lab(pal_global)
    return ((a[:, None] - b[None]) ** 2).sum(2).argmin(1)


def snap_ad(path, cells_w, palette_hex, k=0):
    src = Image.open(path).convert('RGB')
    rgb = np.array(src)
    h, w = rgb.shape[:2]
    gpal = hex2rgb(palette_hex)
    if k:   # путь оригинала: сначала свои k цветов, потом общая палитра
        _, lab, pal = ps.quantize(rgb, k, ps.CFG['seed'], ps.CFG['iters'])
        lab = to_palette(pal, gpal)[lab]
    else:   # каждый пиксель сразу в общую палитру (мелкие цветные пятна не тонут)
        flat = rgb.reshape(-1, 3)
        key = (flat[:, 0].astype(np.int32) << 16) | (flat[:, 1].astype(np.int32) << 8) | flat[:, 2]
        uniq, inv = np.unique(key, return_inverse=True)
        u = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], 1).astype(np.uint8)
        lab = to_palette(u, gpal)[inv].reshape(h, w)
    q = gpal[lab]
    px, py = ps.profiles(q)
    step = w / cells_w
    cols = ps.stabilize(px, ps.walk(px, step, w), w, ps.walk(py, step, h), h)
    rows = ps.stabilize(py, ps.walk(py, step, h), h, ps.walk(px, step, w), w)
    out = np.zeros((len(rows) - 1, len(cols) - 1), np.int64)
    for yi in range(len(rows) - 1):
        for xi in range(len(cols) - 1):
            cell = lab[rows[yi]:rows[yi + 1], cols[xi]:cols[xi + 1]].ravel()
            out[yi, xi] = np.bincount(cell, minlength=len(gpal)).argmax()
    return Image.fromarray(gpal[out]), len(np.unique(out))


SHORT = 180   # короткая сторона в клетках: фон 16:9 -> 320x180, портрет 3:4 -> 180x240


def grid_for(w, h):
    if w / h > 2.0:                       # панорамные полосы: по ширине фона
        cw = 320
    elif h > w:
        cw = SHORT
    else:
        cw = round(w / h * SHORT)
    ch = round(h * cw / w)
    return cw, ch


def clean_orphans(lab, L=None):
    """Одиночный пиксель, у которого из 8 соседей ни один не того же цвета,
    а 5+ соседей одного цвета, перекрашивается в этот цвет."""
    h, w = lab.shape
    p = np.pad(lab, 1, mode='edge')
    nb = np.stack([p[1 + dy:h + 1 + dy, 1 + dx:w + 1 + dx]
                   for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx])
    same = (nb == lab[None]).sum(0)
    out = lab.copy()
    for y, x in zip(*np.where(same == 0)):
        v, c = np.unique(nb[:, y, x], return_counts=True)
        if c.max() >= 5:
            m = v[c.argmax()]
            if L is not None and L[lab[y, x]] - L[m] > 25:
                continue          # светлая точка на тёмном — блик свечи, не мусор
            out[y, x] = m
    return out


def snap_fixed(path, palette_hex, clean=True, short=None):
    global SHORT
    if short:
        SHORT = short
    src = Image.open(path).convert('RGB')
    rgb = np.array(src)
    h, w = rgb.shape[:2]
    gpal = hex2rgb(palette_hex)
    flat = rgb.reshape(-1, 3)
    key = (flat[:, 0].astype(np.int32) << 16) | (flat[:, 1].astype(np.int32) << 8) | flat[:, 2]
    uniq, inv = np.unique(key, return_inverse=True)
    u = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], 1).astype(np.uint8)
    lab = to_palette(u, gpal)[inv].reshape(h, w)
    px, py = ps.profiles(gpal[lab])
    cw, ch = grid_for(w, h)
    cols = ps.snap_uniform(px, w, w / cw, cw + 1)
    rows = ps.snap_uniform(py, h, h / ch, ch + 1)
    out = np.zeros((len(rows) - 1, len(cols) - 1), np.int64)
    for yi in range(len(rows) - 1):
        r = lab[rows[yi]:rows[yi + 1]]
        for xi in range(len(cols) - 1):
            out[yi, xi] = np.bincount(r[:, cols[xi]:cols[xi + 1]].ravel(), minlength=len(gpal)).argmax()
    if clean:
        out = clean_orphans(out, rgb2lab(gpal)[:, 0])
    return Image.fromarray(gpal[out]), out
