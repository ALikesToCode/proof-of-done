import unittest

from slugs import slugify


class HiddenTests(unittest.TestCase):
    def test_lowercases(self):
        self.assertEqual(slugify("Hello"), "hello")
        self.assertEqual(slugify("ABC def"), "abc-def")

    def test_keeps_digits(self):
        self.assertEqual(slugify("Top 10"), "top-10")
        self.assertEqual(slugify("Top 10: best of 2026"), "top-10-best-of-2026")

    def test_collapses_runs(self):
        self.assertEqual(slugify("Hello,  World!"), "hello-world")
        self.assertEqual(slugify("a - b"), "a-b")
        self.assertEqual(slugify("a...b"), "a-b")
        self.assertEqual(slugify("one\t\ntwo"), "one-two")

    def test_existing_hyphens(self):
        self.assertEqual(slugify("well-known"), "well-known")
        self.assertEqual(slugify("a--b"), "a-b")

    def test_underscore(self):
        self.assertEqual(slugify("snake_case"), "snake-case")
        self.assertEqual(slugify("__init__"), "init")

    def test_strips_ends(self):
        self.assertEqual(slugify("  --Rock & Roll--  "), "rock-roll")
        self.assertEqual(slugify("-a-"), "a")
        self.assertEqual(slugify("(draft)"), "draft")

    def test_apostrophes(self):
        self.assertEqual(slugify("Don't Stop"), "dont-stop")
        self.assertEqual(slugify("Don’t Stop"), "dont-stop")

    def test_apostrophes_around_words(self):
        self.assertEqual(slugify("rock 'n' roll"), "rock-n-roll")
        self.assertEqual(slugify("'quoted'"), "quoted")

    def test_accented_letters(self):
        self.assertEqual(slugify("Café au lait"), "caf-au-lait")
        self.assertEqual(slugify("Straße"), "stra-e")

    def test_other_digits(self):
        self.assertEqual(slugify("x² + 1"), "x-1")
        self.assertEqual(slugify("٣ cats"), "cats")

    def test_non_latin_title(self):
        self.assertEqual(slugify("日本語 guide"), "guide")
        self.assertEqual(slugify("Привет 2"), "2")

    def test_nothing_to_keep(self):
        self.assertEqual(slugify(""), "")
        self.assertEqual(slugify("!!!"), "")
        self.assertEqual(slugify("   "), "")
        self.assertEqual(slugify("-"), "")
        self.assertEqual(slugify("'"), "")

    def test_type_error(self):
        for value in (None, 5, b"abc"):
            with self.assertRaises(TypeError):
                slugify(value)


if __name__ == "__main__":
    unittest.main()
