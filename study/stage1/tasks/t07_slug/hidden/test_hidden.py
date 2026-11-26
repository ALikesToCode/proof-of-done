import unittest

from slug import slugify, unique_slug


class HiddenTests(unittest.TestCase):
    def test_visible_cases(self):
        self.assertEqual(slugify("Hello, World!"), "hello-world")
        self.assertEqual(slugify("the quick brown fox", 12), "the-quick")
        self.assertEqual(slugify("the quick", 50), "the-quick")
        self.assertEqual(unique_slug("Hello", []), "hello")
        self.assertEqual(unique_slug("Hello", ["hello"]), "hello-2")

    def test_existing_rules_stay(self):
        self.assertEqual(slugify("Crème Brûlée"), "creme-brulee")
        self.assertEqual(slugify("  --Spaces   and___underscores--  "), "spaces-and-underscores")
        self.assertEqual(slugify("Version 2.0 (beta)"), "version-2-0-beta")
        self.assertEqual(slugify(""), "untitled")
        self.assertEqual(slugify("???"), "untitled")
        self.assertEqual(slugify("Hello", None), "hello")

    def test_exact_fit(self):
        self.assertEqual(slugify("the quick brown fox", 9), "the-quick")
        self.assertEqual(slugify("the quick brown fox", 15), "the-quick-brown")
        self.assertEqual(slugify("the quick brown fox", 19), "the-quick-brown-fox")

    def test_cut_just_after_a_hyphen(self):
        self.assertEqual(slugify("the quick brown fox", 10), "the-quick")
        self.assertEqual(slugify("the quick brown fox", 4), "the")

    def test_cut_inside_second_word(self):
        self.assertEqual(slugify("the quick brown fox", 8), "the")
        self.assertEqual(slugify("the quick brown fox", 14), "the-quick")

    def test_first_word_too_long(self):
        self.assertEqual(slugify("extraordinary", 5), "extra")
        self.assertEqual(slugify("extraordinary claims", 13), "extraordinary")
        self.assertEqual(slugify("extraordinary claims", 12), "extraordinar")
        self.assertEqual(slugify("the quick", 2), "th")
        self.assertEqual(slugify("a b", 1), "a")

    def test_untitled_is_shortened(self):
        self.assertEqual(slugify("!!!", 3), "unt")
        self.assertEqual(slugify("", 8), "untitled")

    def test_bad_max_length(self):
        for value in (0, -1):
            with self.assertRaises(ValueError):
                slugify("hello", value)
            with self.assertRaises(ValueError):
                unique_slug("hello", [], value)

    def test_unique_counts_up(self):
        self.assertEqual(unique_slug("Hello", ["hello", "hello-2"]), "hello-3")
        self.assertEqual(unique_slug("Hello", ["hello", "hello-3"]), "hello-2")
        self.assertEqual(unique_slug("Hello", {"hello", "hello-2", "hello-3"}), "hello-4")
        self.assertEqual(unique_slug("Hello", ("hello",)), "hello-2")

    def test_unique_does_not_change_taken(self):
        taken = ["hello"]
        unique_slug("Hello", taken)
        self.assertEqual(taken, ["hello"])

    def test_unique_free_with_max_length(self):
        self.assertEqual(unique_slug("the quick brown", [], 12), "the-quick")
        self.assertEqual(unique_slug("the quick brown", {"the"}, 12), "the-quick")

    def test_unique_suffix_fits_in_max_length(self):
        self.assertEqual(unique_slug("the quick brown", {"the-quick"}, 12), "the-quick-2")
        self.assertEqual(unique_slug("the quick brown", {"the-quick"}, 11), "the-quick-2")
        self.assertEqual(unique_slug("the quick brown", {"the-quick"}, 10), "the-2")
        self.assertEqual(unique_slug("extraordinary", {"extra"}, 5), "ext-2")

    def test_unique_suffix_grows(self):
        taken = {"abcdef"} | {f"abcd-{n}" for n in range(2, 10)}
        self.assertEqual(unique_slug("abcdef", taken, 6), "abc-10")
        taken = {"ab-cd"} | {f"ab-{n}" for n in range(2, 10)}
        self.assertEqual(unique_slug("ab cd", taken, 5), "ab-10")

    def test_unique_skips_taken_shortened_forms(self):
        self.assertEqual(unique_slug("the quick brown", {"the-quick", "the-2"}, 10), "the-3")

    def test_unique_no_room_for_base(self):
        with self.assertRaises(ValueError):
            unique_slug("hello", {"he"}, 2)
        with self.assertRaises(ValueError):
            unique_slug("a", {"a"}, 1)

    def test_unique_one_character_base(self):
        self.assertEqual(unique_slug("hello", {"hel"}, 3), "h-2")


if __name__ == "__main__":
    unittest.main()
