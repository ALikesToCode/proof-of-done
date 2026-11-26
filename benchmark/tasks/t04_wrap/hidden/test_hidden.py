import unittest

from wrap import wrap


class HiddenTests(unittest.TestCase):
    def test_visible_cases(self):
        self.assertEqual(wrap("hello world", 20), ["hello world"])
        self.assertEqual(wrap("the quick brown fox jumps", 10), ["the quick", "brown fox", "jumps"])
        self.assertEqual(wrap("a   b    c", 20), ["a b c"])
        self.assertEqual(wrap("the quick brown fox", 10, "  "), ["the quick", "  brown", "  fox"])

    def test_exact_fit(self):
        self.assertEqual(wrap("abcde fghi", 10), ["abcde fghi"])
        self.assertEqual(wrap("abcde fghij", 10), ["abcde", "fghij"])
        self.assertEqual(wrap("abcdefghij", 10), ["abcdefghij"])

    def test_empty_text(self):
        self.assertEqual(wrap("", 10), [""])
        self.assertEqual(wrap("   ", 10), [""])
        self.assertEqual(wrap("", 10, "    "), [""])

    def test_paragraphs(self):
        self.assertEqual(wrap("a\n\nb", 10), ["a", "", "b"])
        self.assertEqual(wrap("one two\nthree", 20), ["one two", "three"])
        self.assertEqual(wrap("a\n", 10), ["a", ""])
        self.assertEqual(wrap("\n", 10), ["", ""])
        self.assertEqual(wrap("a\n  \t \nb", 10), ["a", "", "b"])

    def test_paragraphs_wrap_separately(self):
        self.assertEqual(wrap("aaa bbb ccc\nddd eee fff", 7), ["aaa bbb", "ccc", "ddd eee", "fff"])

    def test_indent_restarts_with_each_paragraph(self):
        self.assertEqual(
            wrap("aaa bbb ccc\nddd eee fff", 7, "> "),
            ["aaa bbb", "> ccc", "ddd eee", "> fff"],
        )

    def test_indent_counts_toward_width(self):
        self.assertEqual(wrap("aa bb cc dd ee", 5, "--"), ["aa bb", "--cc", "--dd", "--ee"])
        for line in wrap("lorem ipsum dolor sit amet consectetur", 9, "    "):
            self.assertLessEqual(len(line), 9)

    def test_other_whitespace_separates_words(self):
        self.assertEqual(wrap("a\tb  \r c", 20), ["a b c"])
        self.assertEqual(wrap("  lead and trail  ", 20), ["lead and trail"])

    def test_long_word_is_split(self):
        self.assertEqual(wrap("abcdefghijkl", 5), ["abcde", "fghij", "kl"])
        self.assertEqual(wrap("abcdefghij", 5), ["abcde", "fghij"])

    def test_long_word_starts_a_new_line(self):
        self.assertEqual(wrap("hi abcdefghijkl", 5), ["hi", "abcde", "fghij", "kl"])

    def test_words_follow_the_last_piece(self):
        self.assertEqual(wrap("abcdefg hi j", 5), ["abcde", "fg hi", "j"])

    def test_long_word_with_indent(self):
        self.assertEqual(wrap("abcdefghijkl", 5, ".."), ["abcde", "..fgh", "..ijk", "..l"])
        self.assertEqual(wrap("x abcdefgh y", 4, ">"), ["x", ">abc", ">def", ">gh", ">y"])

    def test_width_one(self):
        self.assertEqual(wrap("ab c", 1), ["a", "b", "c"])

    def test_bad_arguments(self):
        for width in (0, -3, 2.5, "10", None):
            with self.assertRaises(ValueError):
                wrap("text", width)
        with self.assertRaises(ValueError):
            wrap("text", 4, "    ")
        with self.assertRaises(ValueError):
            wrap("text", 4, "     ")

    def test_indent_just_shorter_than_width(self):
        self.assertEqual(wrap("ab cd", 2, "-"), ["ab", "-c", "-d"])


if __name__ == "__main__":
    unittest.main()
