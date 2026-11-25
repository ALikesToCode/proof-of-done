import unittest

from slug import slugify, unique_slug


class VisibleTests(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(slugify("Hello, World!"), "hello-world")

    def test_max_length_keeps_whole_words(self):
        self.assertEqual(slugify("the quick brown fox", 12), "the-quick")

    def test_short_enough_is_unchanged(self):
        self.assertEqual(slugify("the quick", 50), "the-quick")

    def test_unique_when_free(self):
        self.assertEqual(unique_slug("Hello", []), "hello")

    def test_unique_adds_suffix(self):
        self.assertEqual(unique_slug("Hello", ["hello"]), "hello-2")


if __name__ == "__main__":
    unittest.main()
