"""Воспроизводимые карты материалов для Blender и glTF. Фото автора не используются.

Запуск: blender --background --python blender/материалы.py
Рельеф ткани и обоев хранится в normal maps, чтобы он сохранялся в Godot.
"""
from pathlib import Path
import bpy
import numpy as np

TEX = Path(__file__).resolve().parents[1] / "textures"


def save_pixels(name, pixels, non_color=False):
    h, w = pixels.shape[:2]
    # Цветовые pixels Blender — линейные; float buffer нужен, чтобы при PNG
    # сохранить их с единственным преобразованием в sRGB. Normal maps — данные.
    image = bpy.data.images.new(name, width=w, height=h, alpha=True, float_buffer=not non_color)
    image.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    image.pixels.foreach_set(np.ascontiguousarray(pixels, dtype=np.float32).ravel())
    image.filepath_raw = str(TEX / name)
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)


def save_normal(name, height):
    # Высота в метрах, один UV-тайл — метр. Центральная разность с бесшовными границами.
    n = height.shape[0]
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * n / 2
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * n / 2
    normal = np.stack((-dx, -dy, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    rgba = np.ones((*height.shape, 4), dtype=np.float32)
    rgba[:, :, :3] = normal * 0.5 + 0.5
    save_pixels(name, rgba, non_color=True)

def generate_wallpaper():
    n = 512
    v, u = np.mgrid[0:n, 0:n] / n
    rng = np.random.default_rng(14)
    height = np.zeros((n, n))
    # Пологие пятна штукатурки и тонкие неровные кромки между ними.
    for size, weight in ((21, 0.0009), (43, 0.00032), (107, 0.00008)):
        grid = rng.normal(0, 1, (size, size))
        x = u * size + 0.32 * np.sin(v * 8 * np.pi)
        y = v * size + 0.28 * np.sin(u * 6 * np.pi)
        ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
        sx, sy = x - ix, y - iy
        sx, sy = sx * sx * (3 - 2 * sx), sy * sy * (3 - 2 * sy)
        a = grid[iy % size, ix % size] * (1 - sx) + grid[iy % size, (ix + 1) % size] * sx
        b = grid[(iy + 1) % size, ix % size] * (1 - sx) + grid[(iy + 1) % size, (ix + 1) % size] * sx
        ridge = a * (1 - sy) + b * sy
        height += weight * np.tanh(ridge * 2.7)
    save_normal("обои_normal.png", height)


def generate(force=False):
    n = 512
    v, u = np.mgrid[0:n, 0:n] / n
    weave = np.sin(2 * np.pi * 128 * u) * np.sin(2 * np.pi * 128 * v) * 0.000025
    if force or not (TEX / "покрывало_normal.png").exists():
        height = weave.copy()
        for coordinate in (u + v, u - v):
            distance = (coordinate * 6 + 0.5) % 1 - 0.5
            height -= 0.0014 * np.exp(-(distance / 0.045) ** 2)
        save_normal("покрывало_normal.png", height)
    if force or not (TEX / "обои_normal.png").exists():
        generate_wallpaper()
    if force or not (TEX / "ткань_normal.png").exists():
        save_normal("ткань_normal.png", weave)
    if force or not (TEX / "ламинат_светлый_diff.png").exists():
        source = bpy.data.images.load(str(TEX / "ламинат_diff.jpg"), check_existing=True)
        width, height = source.size
        pixels = np.empty(width * height * 4, dtype=np.float32)
        source.pixels.foreach_get(pixels)
        pixels = pixels.reshape(height, width, 4)
        # JPG загружается в byte buffer: pixels здесь ещё кодированы sRGB.
        # Декодируем перед изменением светлоты и сохранением через float buffer.
        rgb = pixels[:, :, :3]
        linear = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
        # Небольшой подъём светлоты в линейном цвете, без потери рисунка досок.
        pixels[:, :, :3] = np.clip(linear * 1.1 + (0.10, 0.11, 0.105), 0, 1)
        save_pixels("ламинат_светлый_diff.png", pixels)


def normal_map(material, file, strength=1.0):
    nt = material.node_tree
    image = bpy.data.images.load(str(TEX / file), check_existing=True)
    image.colorspace_settings.name = "Non-Color"
    texture = nt.nodes.new("ShaderNodeTexImage")
    texture.image = image
    normal = nt.nodes.new("ShaderNodeNormalMap")
    normal.inputs["Strength"].default_value = strength
    nt.links.new(texture.outputs["Color"], normal.inputs["Color"])
    nt.links.new(normal.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])


if __name__ == "__main__":
    generate(force=True)
