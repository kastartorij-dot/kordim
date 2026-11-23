"""Прогоняет все Инструменты/проверка_*.gd в Godot headless и честно считает итог.

    python Игры/Общага/Инструменты/прогнать_проверки.py --godot /путь/к/godot

Зачем отдельный скрипт, а не цикл в workflow. Проверки пишутся в двух стилях:
одни сообщают о провале через quit(1), другие — через голый assert(). Упавший
assert не завершает процесс: Godot печатает ошибку и зависает, а при успешном
«хвосте» может вернуть 0. Поэтому проверка считается пройденной, только если
одновременно: процесс завершился сам (не по таймауту), код выхода 0, в выводе
есть строка с «OK» и нет «SCRIPT ERROR» / «Assertion failed» / «Parse Error».

Проверки идут строго по очереди: в README отмечено, что параллельный прогон
даёт ложные срабатывания (луч попадает в подвижный объект вместо выключателя).
"""
import argparse
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

# Один и тот же файл гоняется с разными флагами (после «--» их читает dorm.gd).
VARIANTS = {
    "проверка_света": [[], ["--daylight-prototype"], ["--daylight-prototype-v2"]],
}
BAD = re.compile(r"SCRIPT ERROR|Assertion failed|Parse Error|Failed to load script")
GOOD = re.compile(r"\bOK\b")


def run_godot(godot, root, extra, timeout):
    cmd = [str(godot), "--headless", "--path", str(root), *extra]
    started = time.monotonic()
    try:
        done = subprocess.run(cmd, cwd=root, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=timeout)
        return done.returncode, done.stdout + done.stderr, False, time.monotonic() - started
    except subprocess.TimeoutExpired as err:
        parts = (err.stdout, err.stderr)
        out = "\n".join(part.decode("utf-8", errors="replace")
                        if isinstance(part, bytes) else part or "" for part in parts)
        return None, out, True, time.monotonic() - started


def verdict(code, out, timed_out):
    if timed_out:
        return "таймаут ожидания завершения Godot"
    if code != 0:
        return f"код выхода {code}"
    if BAD.search(out):
        return "в выводе ошибка скрипта, хотя код выхода 0"
    if not GOOD.search(out):
        return "нет строки «OK» в выводе"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--godot", required=True, type=Path, help="путь к исполняемому файлу Godot 4.7.x")
    ap.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    ap.add_argument("--timeout", type=int, default=180, help="секунд на одну проверку")
    ap.add_argument("--import-timeout", type=int, default=900, help="секунд на первичный импорт ресурсов")
    ap.add_argument("--only", help="часть имени проверки, например «поз»")
    ap.add_argument("--no-import", action="store_true", help="не импортировать ресурсы заранее")
    ap.add_argument("--log-dir", type=Path, help="куда сложить полные логи (по умолчанию builds/логи-проверок)")
    args = ap.parse_args()

    root = args.root.resolve()
    # Godot запускается с cwd=проект, поэтому путь к нему нужно сделать абсолютным заранее.
    found = shutil.which(str(args.godot))
    if not found:
        print(f"Не найден исполняемый файл Godot: {args.godot}")
        return 2
    godot = Path(found).resolve()
    log_dir = (args.log_dir or root / "builds" / "логи-проверок").resolve()
    log_dir.mkdir(parents=True, exist_ok=True)

    if not args.no_import:
        print("Импорт ресурсов Godot…", flush=True)
        code, out, timed_out, took = run_godot(
            godot, root, ["--editor", "--import", "--quit"], args.import_timeout)
        (log_dir / "00_импорт.log").write_text(out, encoding="utf-8")
        if timed_out or code != 0 or BAD.search(out):
            print(f"Импорт не удался ({'таймаут' if timed_out else f'код {code}, см. ошибки импорта в логе'}), {took:.0f} с. Хвост лога:")
            print("\n".join(out.splitlines()[-25:]))
            return 1
        print(f"Импорт готов за {took:.0f} с.\n", flush=True)

    scripts = sorted((root / "Инструменты").glob("проверка_*.gd"))
    if args.only:
        scripts = [s for s in scripts if args.only in s.stem]
    if not scripts:
        print("Не найдено ни одной проверки.")
        return 1

    results = []
    for number, script in enumerate(scripts, 1):
        for variant in VARIANTS.get(script.stem, [[]]):
            title = script.stem + (" " + " ".join(variant) if variant else "")
            extra = ["--script", f"Инструменты/{script.name}"] + (["--", *variant] if variant else [])
            code, out, timed_out, took = run_godot(godot, root, extra, args.timeout)
            safe = re.sub(r"[^\w.-]+", "_", title)
            (log_dir / f"{number:02d}_{safe}.log").write_text(out, encoding="utf-8")
            why = verdict(code, out, timed_out)
            print(f"{'ok  ' if why is None else 'FAIL'} {title}  ({took:.1f} с)" + (f" — {why}" if why else ""), flush=True)
            if why:
                print("     --- хвост вывода ---")
                for line in out.splitlines()[-12:]:
                    print("     " + line)
            results.append((title, why))

    failed = [t for t, why in results if why]
    print(f"\nПройдено {len(results) - len(failed)} из {len(results)}.")
    if failed:
        print("Упали:", "; ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
