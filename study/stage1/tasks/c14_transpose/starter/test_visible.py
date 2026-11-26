import unittest

from grid import transpose


class VisibleTests(unittest.TestCase):
    def test_square(self):
        self.assertEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]])

    def test_single_cell(self):
        self.assertEqual(transpose([[7]]), [[7]])

    def test_wide(self):
        self.assertEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])

    def test_tall(self):
        self.assertEqual(transpose([[1], [2], [3]]), [[1, 2, 3]])

    def test_empty(self):
        self.assertEqual(transpose([]), [])

    def test_ragged(self):
        with self.assertRaises(ValueError):
            transpose([[1, 2], [3]])


if __name__ == "__main__":
    unittest.main()
