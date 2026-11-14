"""Запуск существующих ракурсов через обычный Blender CLI.

blender --background --threads 6 --python Инструменты/рендер.py -- вид --fast
blender --background --threads 6 --python Инструменты/рендер.py -- ф1 окно --свет=ночь --ночник --fast
"""
from pathlib import Path
import runpy
import sys

script = Path(__file__).resolve().parents[1] / "blender" / "комната.py"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
sys.argv = [str(script), *args]
runpy.run_path(str(script), run_name="__main__")
