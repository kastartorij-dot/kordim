# Текстуры, которых нет на Poly Haven — рисуются кодом (PIL) по фото автора. Запуск: python3 blender/текстуры.py
# Кладёт PNG в textures/. Повторный запуск даёт те же картинки (зерно случайности постоянное).
import os, random, math
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "textures")
R = random.Random(1026)

def save(im, name):
    im.save(os.path.join(OUT, name)); print(name, im.size)

def розы(n=1024):
    """Пододеяльник с розами: кремовый фон, розовые бутоны, зелёные листья (фото с кроватью у шторы)."""
    im = Image.new("RGB", (n, n), (238, 236, 226)); d = ImageDraw.Draw(im)
    for _ in range(70):
        x, y = R.randrange(n), R.randrange(n)
        for _ in range(4):   # листья
            a = R.uniform(0, 6.28); r = R.randint(18, 34)
            lx, ly = x + math.cos(a) * 34, y + math.sin(a) * 34
            d.ellipse((lx - r, ly - r * 0.5, lx + r, ly + r * 0.5), fill=(R.randint(40, 70), R.randint(110, 140), R.randint(50, 70)))
        rr = R.randint(22, 36)
        for k in range(5):   # бутон — концентрические лепестки
            c = (min(255, 225 - k * 12), max(0, 120 - k * 18), max(0, 150 - k * 15))
            s = rr * (1 - k * 0.18)
            d.ellipse((x - s, y - s, x + s, y + s), fill=c)
    return im.filter(ImageFilter.GaussianBlur(1.2))

def узор_синий(n=1024):
    """Пододеяльник «туаль»: синие веточки, домики и завитки по белому (фото с синим узором)."""
    im = Image.new("RGB", (n, n), (240, 238, 228)); d = ImageDraw.Draw(im)
    blue = (40, 60, 120)
    for _ in range(45):
        x, y = R.randrange(n), R.randrange(n)
        for _ in range(R.randint(8, 16)):   # ветка: штрихи
            a = R.uniform(-2.6, -0.5); l = R.randint(20, 70)
            x2, y2 = x + math.cos(a) * l, y + math.sin(a) * l
            d.line((x, y, x2, y2), fill=blue, width=R.randint(2, 4))
            for _ in range(3):
                d.ellipse((x2 - 5, y2 - 3, x2 + 5, y2 + 3), fill=blue)
            x, y = (x + x2) / 2, (y + y2) / 2
        if R.random() < 0.3:   # домик
            hx, hy = R.randrange(n), R.randrange(n)
            d.rectangle((hx, hy, hx + 40, hy + 30), outline=blue, width=3)
            d.polygon([(hx - 5, hy), (hx + 20, hy - 22), (hx + 45, hy)], outline=blue)
    return im.filter(ImageFilter.GaussianBlur(0.8))

def мрамор(n=1024):
    """Пластиковые панели санузла «под бежевый мрамор»: светлый фон, мягкие прожилки, вертикальные стыки."""
    im = Image.new("RGB", (n, n), (228, 218, 196)); d = ImageDraw.Draw(im)
    for _ in range(60):
        x, y = R.randrange(n), R.randrange(n)
        pts = [(x, y)]
        for _ in range(12):
            x += R.randint(-30, 30); y += R.randint(10, 50); pts.append((x, y))
        d.line(pts, fill=(200, 188, 165), width=R.randint(1, 4))
    im = im.filter(ImageFilter.GaussianBlur(3))
    d = ImageDraw.Draw(im)
    for x in range(0, n, n // 4):   # стыки панелей по 25 см
        d.line((x, 0, x, n), fill=(205, 196, 176), width=2)
    return im

def полотенце(n=512):
    """Полосатое полотенце: бирюза, фиолетовый, розовый, белый (фото в зеркале)."""
    im = Image.new("RGB", (n, n)); d = ImageDraw.Draw(im)
    cols = [(60, 190, 200), (120, 60, 160), (230, 80, 150), (245, 245, 245), (40, 120, 190), (230, 80, 150)]
    x = 0; i = 0
    while x < n:
        w = R.randint(18, 50); d.rectangle((x, 0, x + w, n), fill=cols[i % len(cols)]); x += w; i += 1
    return im

def панелька(lit=False, n=1024):
    """Фасад панельной многоэтажки: тайл 12 × 12 м — 4 этажа по 3 м, 4 окна; часть окон светится вечером."""
    im = Image.new("RGB", (n, n), (200, 192, 176)); d = ImageDraw.Draw(im)
    px = n / 12
    for fl in range(4):
        for bay in range(4):
            x0 = (bay * 3 + 0.7) * px; y0 = (fl * 3 + 0.9) * px
            on = lit and R.random() < 0.35
            c = (255, 205, 130) if on else (R.randint(40, 70), R.randint(50, 75), R.randint(60, 85))
            d.rectangle((x0, y0, x0 + 1.6 * px, y0 + 1.5 * px), fill=c)
            d.line((x0 + 0.8 * px, y0, x0 + 0.8 * px, y0 + 1.5 * px), fill=(235, 235, 230), width=3)
        d.line((0, (fl * 3 + 2.7) * px, n, (fl * 3 + 2.7) * px), fill=(180, 172, 158), width=4)   # шов плит
    return im

def кирпич(n=1024):
    """Кирпичный фасад дома напротив: тайл 9 × 9 м — 3 этажа, окна в бирюзовых рамах, тёмные перемычки."""
    im = Image.new("RGB", (n, n), (132, 62, 38)); d = ImageDraw.Draw(im)
    px = n / 9
    for row in range(0, n, 6):   # кладка
        d.line((0, row, n, row), fill=(118, 55, 34), width=1)
    for fl in range(3):
        for bay in range(2):
            x0 = (bay * 4.5 + 1.2) * px; y0 = (fl * 3 + 0.8) * px
            d.rectangle((x0 - 0.25 * px, y0 - 0.35 * px, x0 + 2.05 * px, y0 - 0.05 * px), fill=(150, 72, 48))   # перемычка
            d.rectangle((x0, y0, x0 + 1.8 * px, y0 + 1.6 * px), fill=(30, 110, 105))
            d.rectangle((x0 + 6, y0 + 6, x0 + 1.8 * px - 6, y0 + 1.6 * px - 6), fill=(25, 35, 40))
            d.line((x0 + 0.9 * px, y0, x0 + 0.9 * px, y0 + 1.6 * px), fill=(30, 110, 105), width=5)
    return im

if __name__ == "__main__":
    save(розы(), "пододеяльник_розы.png")
    save(узор_синий(), "пододеяльник_синий.png")
    save(мрамор(), "панели_санузла.png")
    save(полотенце(), "полотенце.png")
    save(панелька(False), "фасад_панелька.png")
    R.seed(7); save(панелька(True), "фасад_панелька_вечер.png")
    save(кирпич(), "фасад_кирпич.png")
