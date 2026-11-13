#!/usr/bin/env bash
# Снимок сцены без окна: Инструменты/снимок.sh [имя.png] [кадров]
# Рисует полный Forward+ на процессоре (lavapipe), медленно, но честно.
set -euo pipefail
cd "$(dirname "$0")/.."
NORA="${NORA:-$HOME/.cache/nora-tools}"
OUT="Снимки/${1:-кадр.png}"
"$NORA/godot" --headless --import --path . >/dev/null 2>&1 || true
xvfb-run -a -s "-screen 0 1920x1080x24" "$NORA/godot" --path . --resolution 1280x720 -- --shot="$OUT" --frames="${2:-60}" 2>&1 | grep -E "снимок|ERROR|SCRIPT" || true
echo "$(pwd)/$OUT"
