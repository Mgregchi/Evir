import math, random, sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from mesh_math import index_bytes, packed_weights
from functools import partial

pack_four = partial(packed_weights, bone_count=4)


class MeshExportTests(unittest.TestCase):
    def test_arbitrary_topology_and_wide_indices(self):
        self.assertEqual(
            index_bytes([0, 130, 255, 255, 130, 2], 256),
            b"\x00\x82\x01\xff\x01\xff\x01\x82\x01\x02",
        )

    def test_invalid_triangles(self):
        for triangles, count in [
            ([], 3),
            ([0, 1], 3),
            ([0, 1, 3], 3),
            ([0, 1, -1], 3),
            ([0, 1, True], 3),
            ([0, 1, 2.0], 3),
            ([0, 1, 2], 0),
            ([0, 1, 2], 65537),
        ]:
            with self.subTest(triangles=triangles, count=count), self.assertRaises(
                ValueError
            ):
                index_bytes(triangles, count)

    def test_expected_weight_layout(self):
        self.assertEqual(pack_four([(0, 1)]), (1, 255))
        self.assertEqual(pack_four([(0, 0.5), (1, 0.5)]), (0x0201, 0x7F80))
        self.assertEqual(
            pack_four([(0, 1), (1, 1), (2, 1), (3, 1)]), (0x04030201, 0x3F404040)
        )

    def test_quantization_sum_and_error(self):
        rng = random.Random(7)
        for _ in range(100):
            weights = [rng.random() for i in range(4)]
            indices, packed = pack_four(list(enumerate(weights)))
            values = [packed >> (8 * i) & 255 for i in range(4)]
            self.assertEqual(sum(values), 255)
            for value, weight in zip(values, weights):
                self.assertLess(abs(value / 255 - weight / sum(weights)), 1 / 255)

    def test_invalid_weights(self):
        for influences in [
            [],
            [(0, 1)] * 5,
            [(0, 1), (0, 1)],
            [(255, 1)],
            [(-1, 1)],
            [(True, 1)],
            [(0, -1)],
            [(0, float("nan"))],
            [(0, float("inf"))],
            [(0, 0)],
        ]:
            with self.subTest(influences=influences), self.assertRaises(ValueError):
                pack_four(influences)

    def test_tendon_count_bounds(self):
        self.assertEqual(packed_weights([(254, 1)], bone_count=255), (255, 255))
        for count in [0, 256, True, 4.0]:
            with self.subTest(count=count), self.assertRaises(ValueError):
                packed_weights([(0, 1)], bone_count=count)
        with self.assertRaises(ValueError):
            packed_weights([(4, 1)], bone_count=4)


if __name__ == "__main__":
    unittest.main()
