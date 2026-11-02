# Собирает ЛИЦА_одним_файлом.html: все картинки встроены, сжаты до 720x960 JPEG.
import base64, io, json, re, sys, os
from PIL import Image
# Запуск: python Персонажи/_onefile.py
d = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(d, "ЛИЦА.html"), encoding="utf-8").read()
def uri(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((720, 960), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "JPEG", quality=80, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
def embed(const, folder, var):
    global src
    m = re.search(r'const %s = (\{.*?\});' % const, src)
    data = json.loads(m.group(1))
    out = {k: [uri(os.path.join(d, folder, n)) for n in v] for k, v in data.items()}
    src = src.replace(m.group(0), "const %s = %s;" % (const, json.dumps(out)))
    src = src.replace('var %s = "%s/";' % (var, folder), 'var %s = "";' % var)
embed("PHOTOS", "Фото", "PB")
embed("PORTRAITS", "Портреты", "PP")
open(os.path.join(d, "ЛИЦА_одним_файлом.html"), "w", encoding="utf-8", newline="").write(src)
