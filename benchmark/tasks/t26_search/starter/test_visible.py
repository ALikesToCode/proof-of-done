import unittest

from search import count_of, find_first, find_last, insert_position


class VisibleTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(find_last([1, 2, 2, 3], 3), 3)

    def test_first_and_last(self):
        self.assertEqual(find_first([1, 2, 2, 3], 2), 1)
        self.assertEqual(find_last([1, 2, 2, 3], 2), 2)

    def test_missing(self):
        self.assertEqual(find_first([1, 3], 2), -1)
        self.assertEqual(find_last([1, 3], 2), -1)

    def test_count_in_the_middle(self):
        self.assertEqual(count_of([1, 2, 2, 3], 2), 2)

    def test_insert_in_the_middle(self):
        self.assertEqual(insert_position([1, 2, 2, 3], 2), 3)


if __name__ == "__main__":
    unittest.main()
