import unittest

from text import truncate


class HiddenTests(unittest.TestCase):
    def test_short_unchanged(self):
        self.assertEqual(truncate("hi", 10), "hi")
        self.assertEqual(truncate("abc", 10), "abc")
        self.assertEqual(truncate("", 5), "")

    def test_exact_fit_unchanged(self):
        self.assertEqual(truncate("abcdefghij", 10), "abcdefghij")

    def test_exact_fit_at_width_4(self):
        self.assertEqual(truncate("abcd", 4), "abcd")

    def test_one_character_too_long(self):
        self.assertEqual(truncate("abcdefghijk", 10), "abcdefg...")

    def test_long_value_is_cut(self):
        self.assertEqual(truncate("abcdefghijklmnop", 10), "abcdefg...")
        self.assertEqual(truncate("abcdefghijklmnop", 12), "abcdefghi...")

    def test_width_4(self):
        self.assertEqual(truncate("abcdef", 4), "a...")

    def test_cut_result_is_width_long(self):
        for width in (4, 7, 12, 20):
            self.assertEqual(len(truncate("x" * 50, width)), width)

    def test_never_longer_than_width(self):
        title = "a long title for a card on the board"
        for width in range(4, 45):
            self.assertLessEqual(len(truncate(title, width)), width)

    def test_whitespace_before_dots_removed(self):
        self.assertEqual(truncate("hello world again", 9), "hello...")
        self.assertEqual(truncate("ab   cdefgh", 7), "ab...")
        self.assertEqual(truncate("ab\tcdefgh", 6), "ab...")

    def test_kept_part_all_whitespace(self):
        self.assertEqual(truncate("     abcdef", 7), "...")

    def test_leading_whitespace_kept_when_cut(self):
        self.assertEqual(truncate("  abcdefghij", 8), "  abc...")

    def test_fitting_value_not_trimmed(self):
        self.assertEqual(truncate("  hi  ", 10), "  hi  ")
        self.assertEqual(truncate("hi   ", 8), "hi   ")

    def test_small_width_rejected(self):
        for width in (3, 0, -1):
            with self.assertRaises(ValueError):
                truncate("abcdef", width)

    def test_small_width_rejected_when_value_fits(self):
        with self.assertRaises(ValueError):
            truncate("ab", 3)
        with self.assertRaises(ValueError):
            truncate("", 1)

    def test_type_error(self):
        for value in (123456, None, b"abcdefghijklmnop"):
            with self.assertRaises(TypeError):
                truncate(value, 10)


if __name__ == "__main__":
    unittest.main()
