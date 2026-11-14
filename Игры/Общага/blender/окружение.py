"""Географическая привязка вида. Не зависит от Blender — можно проверить обычным Python."""
import json
import math
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "assets" / "osm"


def load_view():
    return json.loads((DATA / "вид.json").read_text(encoding="utf-8"))


VIEW = load_view()


def to_room(e, n, length, width, view=VIEW):
    # Географический азимут: от севера по часовой стрелке.
    a = math.radians(view["window_azimuth_deg"])
    dx, dy = e - view["window_center_en_m"][0], n - view["window_center_en_m"][1]
    return (length + 0.3 + dx * math.sin(a) + dy * math.cos(a),
            width / 2 - dx * math.cos(a) + dy * math.sin(a))


def number(tags, key, default=0.0):
    try:
        return float(str(tags.get(key, default)).removesuffix(" m").strip())
    except (ValueError, TypeError):
        return default


def building_span(bid, tags, view=VIEW):
    """OSM height — верх над землёй, не толщина части. min_level — её низ."""
    top = view["height_overrides_m"].get(bid)
    if top is None:
        top = number(tags, "height") or (number(tags, "building:levels", 1) * 3.0)
    bottom = number(tags, "min_height", number(tags, "building:min_level") * 3.0)
    return bottom - view["floor_height_m"], top - view["floor_height_m"]


def building_kind(tags):
    material = tags.get("building:material") or tags.get("building:cladding")
    kind = tags.get("building") or tags.get("building:part")
    if material == "glass":
        return "стекло"
    if material == "brick" or kind in ("school", "office"):
        return "кирпич"
    if kind in ("apartments", "dormitory", "residential"):
        return "панель"
    return "прочее"


def is_own_building(bid, building, view=VIEW):
    return (building.get("rel") == view["own_relation"] or
            bid in view["own_ways"] or
            bid in {f'r{view["own_relation"]}_{way}' for way in view["own_ways"]})
