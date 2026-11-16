"""Проверенный Windows-экспорт и переносимые ZIP. Запуск: python Инструменты/сборка.py --godot /путь/godot"""
from pathlib import Path
import argparse, subprocess, tempfile, zipfile, os, json, hashlib
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser();parser.add_argument('--godot',default=os.environ.get('GODOT_BIN','godot'));args=parser.parse_args()
engine=str(Path(args.godot).resolve()) if Path(args.godot).exists() else args.godot
version=subprocess.check_output([engine,'--version'],text=True).strip()
if not version.startswith('4.7.'): raise SystemExit('Нужен Godot 4.7.x: '+version)
def run(*extra,cwd=ROOT):
 subprocess.run([engine,'--headless',*extra],cwd=cwd,check=True)
run('--editor','--path',str(ROOT),'--import','--quit')
exe=ROOT/'builds/windows/Dorm.exe';exe.parent.mkdir(parents=True,exist_ok=True)
run('--path',str(ROOT),'--export-release','Windows',str(exe))
# Пакет проверяется из пустой папки, без fallback на исходники проекта.
with tempfile.TemporaryDirectory(prefix='dorm-pack-') as temp:
 run('--path',temp,'--main-pack',str(exe),'--quit-after','5',cwd=temp)
output=ROOT/'Сборки';output.mkdir(exist_ok=True)
text='''Общага — Godot 4.7.2.
Распакуйте архив и запустите Dorm.exe.
Клик — мышь; WASD/стрелки — ходьба; Shift — бег; пробел — прыжок.
E — взаимодействовать с предметом под прицелом (до 2 метров).
Ctrl — присесть (удерживать). E по стулу — сесть, по кровати — лечь.
E или пробел в позе отдыха — встать.
H / кнопка «Управление» — инструкция; Esc — отпустить мышь; F11 — полный экран.
F5 — сохранить; F9 — загрузить; L — день/вечер/ночник.
N — цвет ночника: розовый/зелёный/тёплый. B — ленты: выкл/красные/фиолетовые.
Цвета и состояние лент сохраняются через F5/F9.
1/2/3/4 — быстрые ракурсы, но весь маршрут доступен пешком.
Перед проходом по коридору закройте дверь санузла.
Шторы, выключатель и ночник управляются клавишей E.
Кровати придвинуты к окну: зазор ~0,2 м; дверь утоплена в общий откос с отдельным порогом.
Длина чёрного столика 0,6 м; все размеры оценочные, не обмер.
Площадка за входной дверью техническая, общий коридор здания не реконструирован.
Проверен встроенный PCK на Linux, сам Windows EXE на ПК автора ещё не проверялся.
COGITO Door — MIT; модель дерева Poly Haven — CC0. Лицензии/источники рядом.
'''
with zipfile.ZipFile(output/'Общага-прогулка-Windows.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 z.write(exe,'Общага/Dorm.exe');z.writestr('Общага/ПРОЧИТАТЬ.txt',text)
 z.write(ROOT/'vendor/cogito/LICENSE','Общага/COGITO-LICENSE.txt')
 z.write(ROOT/'vendor/cogito/README.md','Общага/COGITO-ADAPTATION.md')
 z.write(ROOT/'textures/ИСТОЧНИКИ.md','Общага/ИСТОЧНИКИ.md')
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z','.'],cwd=ROOT).decode().split('\0')
with zipfile.ZipFile(output/'Общага-прогулка-Godot.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for name in sorted(set(filter(None,files))):
  p=Path(name)
  if any(part in {'Сборки','shots','.godot','builds','референсы_локально','__pycache__'} for part in p.parts):continue
  if (ROOT/p).is_file():z.write(ROOT/p,Path('Общага')/p)
report={'engine':version,'windows_exe_run_on_windows':False,'embedded_pack_checked_on_linux':True,'archives':{}}
for name in ['Общага-прогулка-Godot.zip','Общага-прогулка-Windows.zip']:
 p=output/name
 if p.stat().st_size >= 100*1024*1024: raise RuntimeError("Архив превышает лимит GitHub 100 MiB: "+name)
 with zipfile.ZipFile(p) as z:
  assert z.testzip() is None
  assert not any(n.lower().endswith(('.mp4','.mov','.mkv')) for n in z.namelist())
 report['archives'][name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(output/'проверка.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
