"""Проверка относительных ссылок во всех .md проекта Общага.

    python Игры/Общага/Инструменты/проверка_ссылок.py

Код выхода 1, если ссылка ведёт на несуществующий файл. Внешние ссылки (http,
https, mailto) и якоря внутри страницы не проверяются. Папка vendor пропускается:
это чужой код со своими документами.
"""
import re
import sys
from pathlib import Path
from urllib.parse import unquote

root = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]).resolve()
LINK = re.compile(r"\]\(([^)\s]+)\)")
SCHEME = re.compile(r"[a-zA-Z][a-zA-Z0-9+.-]*:")

LOCAL_OR_EXTERNAL = {"vendor", "builds", "shots", "Godot", ".godot", "референсы_локально"}

checked = 0
broken = []
for md in sorted(root.rglob("*.md")):
    if LOCAL_OR_EXTERNAL.intersection(md.relative_to(root).parts[:-1]):
        continue
    for target in LINK.findall(md.read_text(encoding="utf-8")):
        if SCHEME.match(target) or target.startswith("#"):
            continue
        path = unquote(target.split("#")[0])
        if not path:
            continue
        checked += 1
        if not (md.parent / path).exists():
            broken.append(f"{md.relative_to(root)} -> {target}")

for line in broken:
    print("БИТАЯ ССЫЛКА:", line)
print(f"Проверено ссылок: {checked}, битых: {len(broken)}")
sys.exit(1 if broken else 0)
