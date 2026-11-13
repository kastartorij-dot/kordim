#!/usr/bin/env bash
# Ставит инструменты для работы над «Норой» в облачной сессии (Linux).
# Повторный запуск ничего не ломает. Кладёт всё в ~/.cache/nora-tools, в репозиторий ничего не пишет.
# После: $NORA/godot — Godot, $NORA/blender/bin/python — Blender как модуль Python (bpy).
set -euo pipefail
GODOT_VER="${GODOT_VER:-4.7.2}"
NORA="${NORA:-$HOME/.cache/nora-tools}"
mkdir -p "$NORA"

# 1. Программный Vulkan (lavapipe) и виртуальный экран — чтобы Godot рисовал полный Forward+ без видеокарты
if ! dpkg -s mesa-vulkan-drivers xvfb >/dev/null 2>&1; then
  apt-get install -y -q mesa-vulkan-drivers libvulkan1 xvfb >/dev/null 2>&1 \
    || { apt-get update -q >/dev/null && apt-get install -y -q mesa-vulkan-drivers libvulkan1 xvfb >/dev/null; }
fi

# 2. Godot с официального сайта (GitHub для облачной сессии закрыт)
if [ ! -x "$NORA/godot" ] || ! "$NORA/godot" --version 2>/dev/null | grep -q "^$GODOT_VER"; then
  curl -sSL -o "$NORA/g.zip" "https://downloads.godotengine.org/?version=$GODOT_VER&flavor=stable&slug=linux.x86_64.zip&platform=linux.64"
  (cd "$NORA" && unzip -oq g.zip && mv -f "Godot_v$GODOT_VER-stable_linux.x86_64" godot && rm g.zip)
fi

# 3. Blender без окна: пакет bpy с PyPI
if [ ! -x "$NORA/blender/bin/python" ]; then
  python3 -m venv "$NORA/blender"
  "$NORA/blender/bin/pip" install -q bpy
fi

echo "Godot:   $("$NORA/godot" --version)"
echo "Blender: $("$NORA/blender/bin/python" -c 'import bpy; print(bpy.app.version_string)')"
echo "export NORA=$NORA"
