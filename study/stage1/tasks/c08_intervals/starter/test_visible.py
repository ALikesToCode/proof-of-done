import unittest

from intervals import merge


class VisibleTests(unittest.TestCase):
    def test_overlapping(self):
        self.assertEqual(merge([(1, 3), (2, 5)]), [(1, 5)])

    def test_apart(self):
        self.assertEqual(merge([(1, 2), (4, 5)]), [(1, 2), (4, 5)])

    def test_touching(self):
        self.assertEqual(merge([(9, 10), (10, 11)]), [(9, 11)])

    def test_out_of_order(self):
        self.assertEqual(merge([(5, 7), (1, 3), (3, 4)]), [(1, 4), (5, 7)])


if __name__ == "__main__":
    unittest.main()
