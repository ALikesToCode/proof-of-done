import unittest

from chunks import chunk, sliding


class HiddenTests(unittest.TestCase):
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


    def test_more_chunks(self):
        self.assertEqual(chunk(list("abcdefg"), 3), [["a", "b", "c"], ["d", "e", "f"], ["g"]])
        self.assertEqual(chunk([1, 2, 3], 1), [[1], [2], [3]])
        self.assertEqual(chunk([1, 2, 3], 3), [[1, 2, 3]])
        self.assertEqual(sum(len(piece) for piece in chunk(list(range(101)), 7)), 101)

    def test_more_sliding(self):
        self.assertEqual(sliding([], 1), [])
        self.assertEqual(sliding([1, 2, 3], 1), [[1], [2], [3]])
        self.assertEqual(sliding([1, 2, 3, 4, 5], 3, 2), [[1, 2, 3], [3, 4, 5]])
        self.assertEqual(sliding([1, 2, 3, 4, 5], 2, 5), [[1, 2]])
        self.assertEqual(sliding([1, 2, 3, 4, 5], 4, 2), [[1, 2, 3, 4]])
        self.assertEqual(len(sliding(list(range(100)), 10)), 91)

    def test_more_bad(self):
        for step in (-1, 0.5, "1"):
            with self.assertRaises(ValueError):
                sliding([1, 2, 3], 2, step)
        with self.assertRaises(ValueError):
            chunk([1, 2, 3], "2")


if __name__ == "__main__":
    unittest.main()
