import unittest

from slugs import slugify


class VisibleTests(unittest.TestCase):
    def test_lowercases(self):
        self.assertEqual(slugify("Hello"), "hello")

    def test_single_space_becomes_hyphen(self):
        self.assertEqual(slugify("hello world"), "hello-world")

    def test_collapses_runs(self):
        self.assertEqual(slugify("Hello,  World!"), "hello-world")

    def test_strips_ends(self):
        self.assertEqual(slugify("  --Rock & Roll--  "), "rock-roll")


if __name__ == "__main__":
    unittest.main()
