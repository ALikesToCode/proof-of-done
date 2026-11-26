import unittest

from wrap import wrap


class VisibleTests(unittest.TestCase):
    def test_short_text_is_one_line(self):
        self.assertEqual(wrap("hello world", 20), ["hello world"])

    def test_wraps_greedily(self):
        self.assertEqual(wrap("the quick brown fox jumps", 10), ["the quick", "brown fox", "jumps"])

    def test_collapses_spaces(self):
        self.assertEqual(wrap("a   b    c", 20), ["a b c"])

    def test_example_with_indent(self):
        self.assertEqual(wrap("the quick brown fox", 10, "  "), ["the quick", "  brown", "  fox"])


if __name__ == "__main__":
    unittest.main()
