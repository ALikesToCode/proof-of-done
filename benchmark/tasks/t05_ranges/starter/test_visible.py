import unittest

from ranges import count, merge, subtract


class VisibleTests(unittest.TestCase):
    def test_merge_overlapping(self):
        self.assertEqual(merge([(1, 5), (3, 8), (20, 30)]), [(1, 8), (20, 30)])

    def test_merge_sorts(self):
        self.assertEqual(merge([(20, 30), (1, 5)]), [(1, 5), (20, 30)])

    def test_subtract_middle(self):
        self.assertEqual(subtract([(1, 10)], [(4, 5)]), [(1, 3), (6, 10)])

    def test_count(self):
        self.assertEqual(count([(1, 3), (2, 5)]), 5)

    def test_bad_range(self):
        with self.assertRaises(ValueError):
            merge([(5, 2)])


if __name__ == "__main__":
    unittest.main()
