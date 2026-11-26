# Генератор процедурных текстур фасадов БЦ «Асгард» (Наличная ул., 44 к1 с1).
# Запуск: python3 blender/асгард_текстуры.py
# Сохраняет 4 PNG-текстуры в textures/ (день и вечер для витража и бежевого вентфасада).
# При желании функции асгард_стекло() и асгард_стена() можно также перенести в blender/текстуры.py.

import os
import random
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "textures")


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, name))
    print(name, im.size)


def асгард_стекло(lit=False, n=1024):
    """Сине-зелёный витражный фасад БЦ «Асгард», тайл 12 × 13.8 м (4 этажа × 8 секций)."""
    rng = random.Random(441)
    im = Image.new("RGB", (n, n), (36, 48, 56))
    d = ImageDraw.Draw(im)

    cols = 8   # шаг вертикальной стойки 1.5 м
    rows = 4   # шаг этажа 3.45 м
    cw = n / cols
    rh = n / rows

    day_tones = [
        (46, 108, 128),
        (58, 124, 146),
        (38, 92, 114),
        (72, 138, 158),
        (50, 114, 136),
        (86, 146, 166),
        (34, 80, 102),
        (64, 130, 148),
    ]
    spandrel_tones = [
        (34, 68, 86),
        (42, 78, 96),
        (28, 58, 76),
    ]

    for r in range(rows):
        y0 = r * rh
        y1 = (r + 1) * rh
        split = y0 + rh * 0.72
        for c in range(cols):
            x0 = c * cw
            x1 = (c + 1) * cw

            base_r, base_g, base_b = rng.choice(day_tones)
            if lit:
                base_r = int(base_r * 0.42)
                base_g = int(base_g * 0.46)
                base_b = int(base_b * 0.52)

            pad_x = max(2, round(cw * 0.032))
            pad_y = max(2, round(rh * 0.020))
            gx0, gy0 = round(x0 + pad_x), round(y0 + pad_y)
            gx1, gy1 = round(x1 - pad_x), round(split - pad_y)

            if lit and rng.random() < 0.34:
                warm = rng.choice(((248, 214, 148), (235, 204, 142), (218, 224, 210)))
                d.rectangle((gx0, gy0, gx1, gy1), fill=warm)
                d.rectangle((gx0, gy0, gx1, gy0 + round((gy1 - gy0) * 0.16)),
                            fill=tuple(int(v * 0.72) for v in warm))
            else:
                h = max(1, gy1 - gy0)
                for dy in range(h):
                    k = 1.14 - 0.30 * (dy / h)
                    col = (
                        min(255, max(0, int(base_r * k))),
                        min(255, max(0, int(base_g * k))),
                        min(255, max(0, int(base_b * k))),
                    )
                    d.line((gx0, gy0 + dy, gx1, gy0 + dy), fill=col)

                if rng.random() < 0.35:
                    hl = (
                        min(255, base_r + 24),
                        min(255, base_g + 26),
                        min(255, base_b + 24),
                    )
                    d.polygon([
                        (gx0, gy0),
                        (gx0 + round((gx1 - gx0) * 0.55), gy0),
                        (gx0, gy0 + round((gy1 - gy0) * 0.48)),
                    ], fill=hl)

            # Горизонтальный импост фрамуги
            transom_y = round(y0 + (split - y0) * 0.26)
            d.rectangle((gx0, transom_y - 1, gx1, transom_y + 1), fill=(42, 54, 62))

            # Межэтажная глухая панель (spandrel)
            sr, sg, sb = rng.choice(spandrel_tones)
            if lit:
                sr, sg, sb = int(sr * 0.45), int(sg * 0.48), int(sb * 0.54)
            sy0, sy1 = round(split + pad_y), round(y1 - pad_y)
            d.rectangle((gx0, sy0, gx1, sy1), fill=(sr, sg, sb))
            d.line((gx0, sy0, gx1, sy0), fill=(min(255, sr + 28), min(255, sg + 32), min(255, sb + 36)))

    for r in range(rows):
        yy = round(r * rh)
        d.rectangle((0, max(0, yy - 2), n, min(n, yy + 2)), fill=(30, 42, 50))
        sp = round(r * rh + rh * 0.72)
        d.rectangle((0, sp - 2, n, sp + 2), fill=(44, 58, 68))

    return im


def асгард_стена(lit=False, n=1024):
    """Светло-бежевый керамогранитный вентфасад БЦ «Асгард» с рядами окон, тайл 12 × 13.8 м."""
    rng = random.Random(442)
    im = Image.new("RGB", (n, n), (214, 206, 191))
    d = ImageDraw.Draw(im)

    # Расшивка керамогранитных плит
    tile_cols, tile_rows = 16, 24
    tw, th = n / tile_cols, n / tile_rows
    for r in range(tile_rows):
        for c in range(tile_cols):
            tone = rng.randint(-6, 6)
            col = (214 + tone, 205 + tone, 190 + tone)
            d.rectangle((round(c * tw) + 1, round(r * th) + 1,
                         round((c + 1) * tw) - 1, round((r + 1) * th) - 1), fill=col)

    cols, rows = 4, 4
    cw, rh = n / cols, n / rows
    for r in range(rows):
        y0 = r * rh
        for c in range(cols):
            x0 = c * cw
            wx0 = round(x0 + cw * 0.18)
            wx1 = round(x0 + cw * 0.82)
            wy0 = round(y0 + rh * 0.18)
            wy1 = round(y0 + rh * 0.70)

            d.rectangle((wx0 - 4, wy0 - 4, wx1 + 4, wy1 + 4), fill=(152, 145, 134))
            d.rectangle((wx0, wy0, wx1, wy1), fill=(52, 58, 62))

            mid = (wx0 + wx1) // 2
            is_lit = lit and rng.random() < 0.28
            for sx0, sx1 in ((wx0 + 4, mid - 2), (mid + 2, wx1 - 4)):
                sy0, sy1 = wy0 + 4, wy1 - 4
                if is_lit:
                    d.rectangle((sx0, sy0, sx1, sy1), fill=(242, 206, 138))
                else:
                    gt = rng.randint(-6, 8)
                    d.rectangle((sx0, sy0, sx1, sy1), fill=(46 + gt, 68 + gt, 82 + gt))
                    d.rectangle((sx0, sy0, sx1, sy0 + round((sy1 - sy0) * 0.28)),
                                fill=(62 + gt, 86 + gt, 102 + gt))
            d.rectangle((wx0 - 6, wy1 + 1, wx1 + 6, wy1 + 7), fill=(186, 180, 168))

    return im


def свечение_окон(image, glass):
    """Отделяет светящиеся стёкла от переплётов и непрозрачной обшивки."""
    mask = Image.new("RGB", image.size)
    mask.putdata([
        (red, green, blue) if (
            (glass and red >= 145 and green >= 140)
            or (not glass and red - blue >= 50 and green - blue >= 30)
        ) else (0, 0, 0)
        for red, green, blue in image.getdata()
    ])
    return mask


if __name__ == "__main__":
    glass_evening = асгард_стекло(True)
    wall_evening = асгард_стена(True)
    save(асгард_стекло(False), "фасад_асгард_стекло.png")
    save(glass_evening, "фасад_асгард_стекло_вечер.png")
    save(асгард_стена(False), "фасад_асгард_стена.png")
    save(wall_evening, "фасад_асгард_стена_вечер.png")
    save(свечение_окон(glass_evening, True), "фасад_асгард_стекло_свечение.png")
    save(свечение_окон(wall_evening, False), "фасад_асгард_стена_свечение.png")
