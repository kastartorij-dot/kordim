"""Восстанавливает частный каталог кадров по Кадры.json. Нужны ffmpeg и оригиналы.

python Инструменты/карта_кадров.py --videos /папка/с/видео
По умолчанию результат в референсы_локально/ (исключён из Git).
"""
import argparse
import base64
import html
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--videos", type=Path, required=True)
    parser.add_argument("--out", type=Path, default=ROOT / "референсы_локально")
    args = parser.parse_args()
    rows = json.loads((ROOT / "Кадры.json").read_text(encoding="utf-8"))
    files = list(args.videos.rglob("*"))
    sources = {}
    for name in {r["video"] for r in rows}:
        matches = [p for p in files if p.is_file() and p.name in (name, name + ".mp4")]
        if len(matches) != 1:
            raise SystemExit(f"Нужен один оригинал {name}; найдено {len(matches)}")
        sources[name] = matches[0]
    args.out.mkdir(parents=True, exist_ok=True)
    cards = []
    esc = html.escape
    for row in rows:
        image = args.out / (row["id"] + ".jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(row["second"]), "-i",
                        str(sources[row["video"]]), "-frames:v", "1", "-vf",
                        "scale=480:-2", "-q:v", "3", "-y", str(image)], check=True)
        encoded = base64.b64encode(image.read_bytes()).decode("ascii")
        row["frame"] = image.name
        cards.append(f'<article data-part="{esc(row["part"])}"><h2>{row["id"]} — {esc(row["title"])}</h2>'
                     f'<p>{esc(row["part"])} · {esc(row["priority"])}</p>'
                     f'<img loading="lazy" src="data:image/jpeg;base64,{encoded}" alt="{row["id"]}">'
                     f'<p>{esc(row["video"])} · {row["second"]:g} с</p><p>{esc(row["note"])}</p></article>')
    categories = sorted({r["part"] for r in rows})
    options = ''.join(f'<option>{esc(c)}</option>' for c in categories)
    document = ('<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
                '<title>Общага — карта кадров</title><style>body{font:16px system-ui;background:#182027;color:#eee;margin:24px}'
                'main{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:18px}'
                'article{background:#26343f;padding:16px;border-radius:10px}h2{font-size:18px}'
                'img{width:100%;height:330px;object-fit:contain;background:#111}p{overflow-wrap:anywhere}'
                'select{font:inherit;padding:8px;margin-bottom:20px}[hidden]{display:none}</style>'
                '<h1>Общага — карта полезных кадров</h1><p>Частный визуальный каталог. Не публиковать вместе с исходниками.</p>'
                f'<select id="part"><option value="">Все части комнаты</option>{options}</select><main>'
                + ''.join(cards) + '</main><script>document.querySelector("#part").onchange=function(){'
                'document.querySelectorAll("article").forEach(e=>e.hidden=!!this.value&&e.dataset.part!==this.value)}'
                '</script></html>')
    (args.out / "index.html").write_text(document, encoding="utf-8")
    (args.out / "index.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Готово: {len(rows)} кадров, {args.out / 'index.html'}")


if __name__ == "__main__":
    main()
