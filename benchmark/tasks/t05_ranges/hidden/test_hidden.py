import unittest

from ranges import count, merge, subtract


class HiddenTests(unittest.TestCase):
    def test_visible_cases(self):
        self.assertEqual(merge([(1, 5), (3, 8), (20, 30)]), [(1, 8), (20, 30)])
        self.assertEqual(merge([(20, 30), (1, 5)]), [(1, 5), (20, 30)])
        self.assertEqual(subtract([(1, 10)], [(4, 5)]), [(1, 3), (6, 10)])
        self.assertEqual(count([(1, 3), (2, 5)]), 5)
        with self.assertRaises(ValueError):
            merge([(5, 2)])

    def test_merge_neighbours(self):
        self.assertEqual(merge([(1, 2), (3, 4)]), [(1, 4)])
        self.assertEqual(merge([(3, 4), (1, 2)]), [(1, 4)])
        self.assertEqual(merge([(1, 1), (2, 2), (3, 3)]), [(1, 3)])

    def test_merge_gap_of_one_stays(self):
        self.assertEqual(merge([(1, 2), (4, 5)]), [(1, 2), (4, 5)])

    def test_merge_contained_and_duplicates(self):
        self.assertEqual(merge([(1, 10), (2, 3), (4, 4)]), [(1, 10)])
        self.assertEqual(merge([(5, 5), (5, 5)]), [(5, 5)])

    def test_merge_negative_numbers(self):
        self.assertEqual(merge([(-5, -3), (-2, 0), (2, 2)]), [(-5, 0), (2, 2)])

    def test_merge_empty(self):
        self.assertEqual(merge([]), [])

    def test_merge_types(self):
        result = merge([(1, 2), (3, 4)])
        self.assertIsInstance(result, list)
        self.assertTrue(all(isinstance(item, tuple) for item in result))

    def test_arguments_not_changed(self):
        ranges = [(8, 9), (1, 5), (3, 8)]
        holes = [(4, 4), (2, 2)]
        merge(ranges)
        subtract(ranges, holes)
        count(ranges)
        self.assertEqual(ranges, [(8, 9), (1, 5), (3, 8)])
        self.assertEqual(holes, [(4, 4), (2, 2)])

    def test_subtract_edges(self):
        self.assertEqual(subtract([(1, 10)], [(1, 3)]), [(4, 10)])
        self.assertEqual(subtract([(1, 10)], [(8, 10)]), [(1, 7)])
        self.assertEqual(subtract([(1, 10)], [(1, 10)]), [])
        self.assertEqual(subtract([(1, 10)], [(0, 11)]), [])
        self.assertEqual(subtract([(1, 10)], [(10, 10)]), [(1, 9)])
        self.assertEqual(subtract([(1, 10)], [(1, 1)]), [(2, 10)])

    def test_subtract_single_points(self):
        self.assertEqual(subtract([(1, 5)], [(3, 3)]), [(1, 2), (4, 5)])
        self.assertEqual(subtract([(3, 3)], [(3, 3)]), [])
        self.assertEqual(subtract([(1, 3)], [(2, 2), (1, 1)]), [(3, 3)])

    def test_subtract_no_overlap(self):
        self.assertEqual(subtract([(1, 5)], [(6, 9)]), [(1, 5)])
        self.assertEqual(subtract([(1, 5)], []), [(1, 5)])
        self.assertEqual(subtract([], [(1, 5)]), [])

    def test_subtract_merges_first(self):
        self.assertEqual(subtract([(1, 2), (3, 4), (10, 12)], [(11, 11)]), [(1, 4), (10, 10), (12, 12)])
        self.assertEqual(subtract([(6, 9), (1, 5)], []), [(1, 9)])

    def test_subtract_many_holes(self):
        self.assertEqual(
            subtract([(1, 20)], [(15, 16), (2, 3), (3, 6), (19, 30)]),
            [(1, 1), (7, 14), (17, 18)],
        )
        self.assertEqual(subtract([(1, 5), (8, 12)], [(4, 9)]), [(1, 3), (10, 12)])

    def test_count(self):
        self.assertEqual(count([]), 0)
        self.assertEqual(count([(3, 3)]), 1)
        self.assertEqual(count([(1, 10)]), 10)
        self.assertEqual(count([(1, 2), (3, 4)]), 4)
        self.assertEqual(count([(1, 5), (1, 5), (2, 3)]), 5)
        self.assertEqual(count([(-2, 2)]), 5)

    def test_bad_ranges_everywhere(self):
        with self.assertRaises(ValueError):
            count([(1, 2), (9, 8)])
        with self.assertRaises(ValueError):
            subtract([(5, 2)], [])
        with self.assertRaises(ValueError):
            subtract([(1, 9)], [(5, 2)])
        with self.assertRaises(ValueError):
            subtract([], [(5, 2)])


if __name__ == "__main__":
    unittest.main()
