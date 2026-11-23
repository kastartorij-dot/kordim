# Генератор процедурных текстур для модели рук, сигареты и рукава (PIL).
# Запуск из корня проекта:
#   python3 blender/руки_сигарета_текстуры.py
# Создаёт textures/сигарета_текстура.png и textures/рукав_ткань.png.

import os
import random
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "textures")


def сигарета_текстура(w=512, h=512):
    """Развёртка сигареты: снизу (v=0) пробковый фильтр -> золотое кольцо -> бумага с полосками -> пепел."""
    rng = random.Random(707)
    im = Image.new("RGB", (w, h), (238, 236, 229))
    d = ImageDraw.Draw(im)

    # В PIL y=0 — верх (кончик/пепел, v=1), y=h — низ (фильтр, v=0)
    y_filter = int(h * 0.72)  # нижние 28% — фильтр
    y_ash = int(h * 0.10)     # верхние 10% — зона тления/пепла

    # 1. Бумага с тонкими горизонтальными полосками
    for y in range(y_ash, y_filter):
        stripe = -5 if (y % 6 == 0) else rng.randint(-2, 2)
        col = (238 + stripe, 236 + stripe, 229 + stripe)
        d.line((0, y, w, y), fill=col)

    # 2. Золотистое декоративное колечко на стыке фильтра и бумаги
    d.rectangle((0, y_filter - 6, w, y_filter + 2), fill=(196, 162, 88))
    d.line((0, y_filter - 6, w, y_filter - 6), fill=(162, 130, 68))

    # 3. Пробковый фильтр с мелкими светлыми и тёмными крапинками
    d.rectangle((0, y_filter + 2, w, h), fill=(208, 138, 66))
    for _ in range(950):
        x = rng.randint(0, w - 1)
        y = rng.randint(y_filter + 4, h - 2)
        rw = rng.randint(2, 8)
        rh = rng.randint(1, 3)
        col = rng.choice(((226, 166, 94), (186, 114, 48), (218, 152, 78), (172, 102, 42)))
        d.rectangle((x, y, x + rw, y + rh), fill=col)

    # 4. Неровная обугленная кромка и пепел вверху
    for x in range(w):
        jag = int(6 * rng.random())
        d.line((x, 0, x, y_ash + jag), fill=(68, 66, 65))
        d.line((x, y_ash + jag, x, y_ash + jag + 4), fill=(44, 34, 28))
        d.line((x, y_ash + jag + 4, x, y_ash + jag + 9), fill=(148, 128, 106))

    return im


def рукав_ткань(w=512, h=512):
    """Тёмно-графитовый трикотаж худи с рельефной резинкой на манжете."""
    rng = random.Random(808)
    im = Image.new("RGB", (w, h), (38, 43, 50))
    d = ImageDraw.Draw(im)

    # Мелкое диагональное переплетение ткани
    for y in range(0, h, 2):
        for x in range(0, w, 4):
            t = rng.randint(-6, 6)
            d.rectangle((x, y, x + 3, y + 1), fill=(38 + t, 43 + t, 50 + t))

    # Манжета в верхней части (v -> 1, у запястья) с вертикальной резинкой
    cuff_h = int(h * 0.22)
    for x in range(w):
        rib = 9 if (x % 8 < 4) else -7
        d.line((x, 0, x, cuff_h), fill=(34 + rib, 39 + rib, 46 + rib))
    d.rectangle((0, cuff_h, w, cuff_h + 3), fill=(24, 27, 32))

    return im


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (("сигарета_текстура.png", сигарета_текстура), ("рукав_ткань.png", рукав_ткань)):
        path = os.path.join(OUT, name)
        fn().save(path)
        print(name, path)
