import unittest

from dedupe import unique


class VisibleTests(unittest.TestCase):
    def test_removes_duplicates(self):
        self.assertEqual(unique([1, 1, 2]), [1, 2])

    def test_empty(self):
        self.assertEqual(unique([]), [])

    def test_keeps_first_seen_order(self):
        self.assertEqual(unique([3, 1, 3, 2, 1]), [3, 1, 2])

    def test_strings_keep_order(self):
        self.assertEqual(unique(["pear", "apple", "pear"]), ["pear", "apple"])

    def test_key(self):
        self.assertEqual(unique(["a", "A", "b"], key=str.lower), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
