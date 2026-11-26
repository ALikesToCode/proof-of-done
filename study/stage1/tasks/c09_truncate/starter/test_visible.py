import unittest

from text import truncate


class VisibleTests(unittest.TestCase):
    def test_short_value_is_kept(self):
        self.assertEqual(truncate("hi", 10), "hi")

    def test_long_value_gets_dots(self):
        self.assertTrue(truncate("a long title for a card", 10).endswith("..."))

    def test_result_fits_width(self):
        self.assertEqual(truncate("abcdefghijklmnop", 10), "abcdefg...")

    def test_rejects_tiny_width(self):
        with self.assertRaises(ValueError):
            truncate("abcdef", 3)


if __name__ == "__main__":
    unittest.main()
