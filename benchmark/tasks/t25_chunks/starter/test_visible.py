import unittest

from chunks import chunk, sliding


class VisibleTests(unittest.TestCase):
    def test_chunk(self):
        self.assertEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
        self.assertEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]])
        self.assertEqual(chunk([], 3), [])
        self.assertEqual(chunk([1], 5), [[1]])

    def test_sliding(self):
        self.assertEqual(sliding([1, 2, 3, 4], 2), [[1, 2], [2, 3], [3, 4]])
        self.assertEqual(sliding([1, 2, 3, 4, 5], 2, 2), [[1, 2], [3, 4]])
        self.assertEqual(sliding([1, 2], 3), [])
        self.assertEqual(sliding([1, 2, 3], 3), [[1, 2, 3]])
        self.assertEqual(sliding([1, 2, 3, 4, 5, 6], 2, 3), [[1, 2], [4, 5]])

    def test_bad(self):
        for size in (0, -1, 1.5):
            with self.assertRaises(ValueError):
                chunk([1], size)
            with self.assertRaises(ValueError):
                sliding([1], size)
        with self.assertRaises(ValueError):
            sliding([1, 2], 1, 0)

    def test_argument_not_changed(self):
        items = [1, 2, 3]
        pieces = chunk(items, 2)
        pieces[0].append(9)
        sliding(items, 2)[0].append(9)
        self.assertEqual(items, [1, 2, 3])


if __name__ == "__main__":
    unittest.main()
