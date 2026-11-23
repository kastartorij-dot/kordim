"""Проверка models/общага.glb и данных, связанных с ним, без Godot и Blender.

Запуск из любой папки:
    python Игры/Общага/Инструменты/проверка_glb.py

Код выхода: 0 — всё в порядке, 1 — есть нарушения, 2 — файл не читается.
Только стандартная библиотека. Что проверяется:
  1. models/подвижные.json: поля, вид движения, уникальность и наличие узлов в GLB;
  2. имена узлов и материалов, на которые ссылается scripts/dorm.gd;
  3. настройка импорта (встроенные изображения);
  4. бюджеты: размер GLB, число треугольников и материалов.

Бюджеты — это потолок «текущее значение + запас». Модель вправе вырасти, но
осознанно: поднимайте константы ниже в том же коммите, что и рост модели.
"""
import argparse
import json
import re
import struct
import sys
from pathlib import Path

# Замер на коммите 38586bf (23.11.2026): 34,0 МБ, 544 582 треугольника, 272 материала.
# Материалов за один день 23.11 стало больше с 261 до 272, поэтому запас у них шире, чем у остальных.
MAX_GLB_MB = 40
MAX_TRIANGLES = 600_000
MAX_MATERIALS = 310

MOVABLE_KINDS = {"slide", "rotate"}  # scripts/movable.gd: всё, что не rotate, едет как slide
MOVABLE_REQUIRED = ("node", "label", "kind", "closed", "opened", "axis")

# dorm.gd ищет шторы через find_child("Curtain_%s") в цикле range(2).
EXTRA_NODES = ("Curtain_0", "Curtain_1")


class Report:
    def __init__(self):
        self.failures = 0

    def ok(self, text):
        print("  ok   ", text)

    def fail(self, text):
        self.failures += 1
        print("  FAIL ", text)


def read_glb(path):
    data = path.read_bytes()
    if len(data) < 20:
        raise ValueError("файл короче заголовка GLB")
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("это не GLB (нет сигнатуры glTF)")
    if version != 2:
        raise ValueError(f"версия glTF {version}, ожидалась 2")
    if length != len(data):
        raise ValueError(f"заголовок говорит {length} байт, в файле {len(data)}: файл обрезан или повреждён")
    chunk_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise ValueError("первый блок GLB не JSON")
    return json.loads(data[20:20 + chunk_len].decode("utf-8")), len(data)


def count_triangles(gltf):
    accessors = gltf.get("accessors", [])
    per_mesh = []
    for mesh in gltf.get("meshes", []):
        total = 0
        for prim in mesh.get("primitives", []):
            mode = prim.get("mode", 4)
            if "indices" in prim:
                n = accessors[prim["indices"]]["count"]
            else:
                n = accessors[prim["attributes"]["POSITION"]]["count"]
            if mode == 4:
                total += n // 3
            elif mode in (5, 6):  # strip, fan
                total += max(0, n - 2)
        per_mesh.append(total)
    users = {}
    for node in gltf.get("nodes", []):
        if "mesh" in node:
            users[node["mesh"]] = users.get(node["mesh"], 0) + 1
    return sum(per_mesh[i] * c for i, c in users.items()), per_mesh


def check_movables(root, node_names, rep):
    path = root / "models" / "подвижные.json"
    try:
        spec = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as err:
        rep.fail(f"{path.name}: не читается ({err})")
        return
    if not isinstance(spec, list) or not spec:
        rep.fail(f"{path.name}: ожидался непустой список")
        return
    bad = 0
    seen = set()
    for i, entry in enumerate(spec):
        who = f"{path.name}[{i}] {entry.get('node', '?')}"
        for key in MOVABLE_REQUIRED:
            if key not in entry:
                rep.fail(f"{who}: нет поля «{key}»")
                bad += 1
        if entry.get("kind") not in MOVABLE_KINDS:
            rep.fail(f"{who}: kind={entry.get('kind')!r}, допустимо {sorted(MOVABLE_KINDS)}")
            bad += 1
        axis = entry.get("axis")
        if not (isinstance(axis, list) and len(axis) == 3 and all(isinstance(a, (int, float)) for a in axis)):
            rep.fail(f"{who}: axis должен быть списком из 3 чисел")
            bad += 1
        name = entry.get("node")
        if name in seen:
            rep.fail(f"{who}: узел указан дважды")
            bad += 1
        seen.add(name)
        if name not in node_names:
            rep.fail(f"{who}: узла нет в GLB")
            bad += 1
        furniture = entry.get("furniture")
        if furniture is not None and furniture not in node_names:
            rep.fail(f"{who}: мебели «{furniture}» нет в GLB")
            bad += 1
    if not bad:
        rep.ok(f"{path.name}: {len(spec)} записей, все узлы и мебель есть в GLB")


def check_dorm_refs(root, node_names, material_names, rep):
    path = root / "scripts" / "dorm.gd"
    try:
        src = path.read_text(encoding="utf-8")
    except OSError as err:
        rep.fail(f"{path.name}: не читается ({err})")
        return
    refs = set(re.findall(r'_furniture_point\("([^"]+)"', src))
    refs |= set(re.findall(
        r'\["([^"]+)",\s*Vector3\([^)]*\),\s*Vector3\([^)]*\),\s*"(?:chair|bed)"', src))
    if not refs:
        rep.fail(f"{path.name}: не нашёл ни одной ссылки на мебель — шаблоны поиска устарели, поправьте проверку")
        return
    missing = sorted(r for r in refs if r not in node_names)
    for r in missing:
        rep.fail(f"dorm.gd ссылается на узел «{r}», в GLB его нет")
    for r in EXTRA_NODES:
        if r not in node_names:
            rep.fail(f"dorm.gd ожидает узел «{r}», в GLB его нет")
            missing.append(r)
    lists = re.findall(r'resource_name not in \[([^\]]+)\]', src)
    wanted = set(re.findall(r'"([^"]+)"', lists[0])) if lists else set()
    if not wanted:
        rep.fail("dorm.gd: не нашёл список материалов подсветки — шаблон поиска устарел")
    for m in sorted(wanted - material_names):
        rep.fail(f"dorm.gd ждёт материал «{m}», в GLB его нет")
        missing.append(m)
    if not missing and wanted:
        rep.ok(f"dorm.gd: узлов мебели {len(refs)}, шторы и материалов подсветки {len(wanted)} — всё есть в GLB")


def check_import(root, rep):
    path = root / "models" / "общага.glb.import"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as err:
        rep.fail(f"{path.name}: не читается ({err})")
        return
    # .gitignore проекта игнорирует извлечённые картинки именно из-за этого значения.
    if re.search(r"^gltf/embedded_image_handling=3\s*$", text, re.M):
        rep.ok("общага.glb.import: изображения хранятся внутри ресурса")
    else:
        rep.fail("общага.glb.import: gltf/embedded_image_handling не равно 3 — Godot начнёт сыпать картинки рядом с моделью")


def main():
    default_root = Path(__file__).resolve().parents[1]
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", type=Path, default=default_root, help="папка проекта Общага")
    ap.add_argument("--max-glb-mb", type=float, default=MAX_GLB_MB)
    ap.add_argument("--max-triangles", type=int, default=MAX_TRIANGLES)
    ap.add_argument("--max-materials", type=int, default=MAX_MATERIALS)
    args = ap.parse_args()
    root = args.root

    glb_path = root / "models" / "общага.glb"
    print(f"Проверка {glb_path}")
    try:
        gltf, size = read_glb(glb_path)
    except (OSError, ValueError, KeyError) as err:
        print(f"  FAIL GLB не читается: {err}")
        return 2

    rep = Report()
    node_names = {n.get("name", "") for n in gltf.get("nodes", [])}
    material_names = {m.get("name", "") for m in gltf.get("materials", [])}

    check_movables(root, node_names, rep)
    check_dorm_refs(root, node_names, material_names, rep)
    check_import(root, rep)

    triangles, per_mesh = count_triangles(gltf)
    mb = size / 1048576
    for label, value, limit, unit in (
        ("размер GLB", mb, args.max_glb_mb, "МБ"),
        ("треугольники", triangles, args.max_triangles, ""),
        ("материалы", len(material_names), args.max_materials, ""),
    ):
        shown = f"{value:,.1f}" if isinstance(value, float) else f"{value:,}"
        limit_shown = f"{limit:,.0f}"
        if value > limit:
            rep.fail(" ".join(f"{label}: {shown} {unit} превышает бюджет {limit_shown} {unit}".split()))
        else:
            rep.ok(" ".join(f"{label}: {shown} {unit} из {limit_shown} {unit}".split()))
    if triangles > args.max_triangles and per_mesh:
        biggest = sorted(
            ((t, gltf["meshes"][i].get("name", f"mesh{i}")) for i, t in enumerate(per_mesh)), reverse=True)[:3]
        print("       крупнейшие меши:", ", ".join(f"{n} ({t:,})" for t, n in biggest))

    print("Итог:", "нарушений нет" if not rep.failures else f"нарушений: {rep.failures}")
    return 1 if rep.failures else 0


if __name__ == "__main__":
    sys.exit(main())
