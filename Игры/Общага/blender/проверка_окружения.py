"""Проверки привязки реального квартала; запуск: python blender/проверка_окружения.py."""
import json
import math
import struct
import unittest
from окружение import DATA, VIEW, to_room, building_span, building_kind, is_own_building


class NeighborhoodTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads((DATA / "окрестности.json").read_text(encoding="utf-8"))

    def test_window_origin_and_distance(self):
        e, n = VIEW["window_center_en_m"]
        x, y = to_room(e, n, 4.6, 3.2)
        self.assertAlmostEqual(x, 4.9)
        self.assertAlmostEqual(y, 1.6)
        # Поворот не должен менять масштаб географических контуров.
        x, y = to_room(e + 30, n + 40, 4.6, 3.2)
        self.assertAlmostEqual(math.hypot(x - 4.9, y - 1.6), 50)

    def test_heading_looks_out_of_room(self):
        e, n = VIEW["window_center_en_m"]
        a = math.radians(VIEW["window_azimuth_deg"])
        x, y = to_room(e + 20 * math.sin(a), n + 20 * math.cos(a), 4.6, 3.2)
        self.assertAlmostEqual(x, 24.9)
        self.assertAlmostEqual(y, 1.6)

    def test_k2_is_in_front_and_spans_eye_level(self):
        b = self.data["buildings"]["85426979"]
        pts = [to_room(e, n, 4.6, 3.2) for e, n in b["p"]]
        self.assertTrue(all(x > 20 for x, y in pts))
        self.assertLess(min(y for x, y in pts), 1.6)
        self.assertGreater(max(y for x, y in pts), 1.6)
        bottom, top = building_span("85426979", b["t"])
        self.assertLess(bottom, 1.62)
        self.assertGreater(top, 1.62)

    def test_real_brick_apartment_and_own_footprints(self):
        self.assertEqual(building_kind(self.data["buildings"]["16237661"]["t"]), "кирпич")
        for way in VIEW["own_ways"]:
            bid = f'r{VIEW["own_relation"]}_{way}'
            self.assertTrue(is_own_building(bid, self.data["buildings"][bid]))
        self.assertFalse(is_own_building("85426979", self.data["buildings"]["85426979"]))

    def test_rooftop_parts_do_not_start_at_ground(self):
        tags = self.data["buildings"]["159547404"]["t"]
        bottom, top = building_span("159547404", tags)
        self.assertEqual((bottom + VIEW["floor_height_m"], top + VIEW["floor_height_m"]), (36, 39))
        self.assertEqual(building_span("test", {"height": "12 m", "min_height": "6"}), (1, 7))


class ExportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = DATA.parents[1] / "models" / "общага.glb"
        if not path.exists():
            raise unittest.SkipTest("Сначала собрать models/общага.glb")
        cls.raw = path.read_bytes()
        length = struct.unpack_from("<I", cls.raw, 12)[0]
        cls.gltf = json.loads(cls.raw[20:20 + length])
        cls.binary_start = 20 + length + 8

    def test_textures_are_embedded(self):
        self.assertGreater(len(self.gltf["images"]), 0)
        self.assertTrue(all("bufferView" in image for image in self.gltf["images"]))
        self.assertFalse(any("uri" in buffer for buffer in self.gltf["buffers"]))

    def test_facade_and_bedding_keep_their_uv_after_join(self):
        checked = set()
        expected = {"фасад_кирпич", "покрывало_зелёное"}
        for mesh in self.gltf["meshes"]:
            for primitive in mesh["primitives"]:
                name = self.gltf["materials"][primitive["material"]].get("name")
                if name not in expected: continue
                accessor = self.gltf["accessors"][primitive["attributes"]["TEXCOORD_0"]]
                view = self.gltf["bufferViews"][accessor["bufferView"]]
                offset = self.binary_start + view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
                uv = [struct.unpack_from("<2f", self.raw, offset + i * view.get("byteStride", 8))
                      for i in range(accessor["count"])]
                for axis in (0, 1):
                    values = [point[axis] for point in uv]
                    self.assertGreater(max(values) - min(values), 0.1, name)
                checked.add(name)
        self.assertEqual(checked, expected)

    def test_desk_strip_is_horizontal(self):
        checked = False
        for mesh in self.gltf["meshes"]:
            for primitive in mesh["primitives"]:
                if self.gltf["materials"][primitive["material"]].get("name") != "лента_стол":
                    continue
                position = self.gltf["accessors"][primitive["attributes"]["POSITION"]]
                self.assertLess(position["max"][1] - position["min"][1], 0.02)
                self.assertGreater(position["max"][0] - position["min"][0], 1.2)
                checked = True
        self.assertTrue(checked, "Не найдена горизонтальная подсветка стола")

    def test_surface_detail_survives_export(self):
        materials = {m["name"]: m for m in self.gltf["materials"]}
        for name in ("покрывало_зелёное", "обои", "шторы"):
            self.assertIn("normalTexture", materials[name], name)
        self.assertNotIn("пододеяльник_розы", materials)
        self.assertNotIn("пододеяльник_синий", materials)


if __name__ == "__main__":
    unittest.main()
