import unittest

from versions import compare


class HiddenTests(unittest.TestCase):
    def bad(self, text):
        with self.assertRaises(ValueError):
            compare(text, "1.0.0")

    def test_equal(self):
        self.assertEqual(compare("1.2.3", "1.2.3"), 0)
        self.assertEqual(compare("3.4.5", "3.4.5"), 0)

    def test_newer_patch(self):
        self.assertEqual(compare("1.2.4", "1.2.3"), 1)
        self.assertEqual(compare("1.2.3", "1.2.4"), -1)

    def test_two_digit_minor(self):
        self.assertEqual(compare("1.10.0", "1.9.0"), 1)
        self.assertEqual(compare("1.9.0", "1.10.0"), -1)

    def test_two_digit_major(self):
        self.assertEqual(compare("2.0.0", "10.0.0"), -1)

    def test_two_digit_patch(self):
        self.assertEqual(compare("1.0.12", "1.0.9"), 1)

    def test_left_to_right(self):
        self.assertEqual(compare("2.0.0", "1.99.99"), 1)
        self.assertEqual(compare("1.2.30", "1.3.0"), -1)

    def test_leading_zeros(self):
        self.assertEqual(compare("1.02.0", "1.2.0"), 0)
        self.assertEqual(compare("01.0.0", "1.0.0"), 0)
        self.assertEqual(compare("1.010.0", "1.9.0"), 1)

    def test_pre_release_is_older(self):
        self.assertEqual(compare("1.2.0-rc1", "1.2.0"), -1)
        self.assertEqual(compare("1.2.0", "1.2.0-rc1"), 1)
        self.assertEqual(compare("1.2.0-1", "1.2.0"), -1)

    def test_numbers_decide_before_tags(self):
        self.assertEqual(compare("1.3.0-rc1", "1.2.9"), 1)
        self.assertEqual(compare("1.2.9", "1.3.0-rc1"), -1)
        self.assertEqual(compare("2.0.0-alpha", "1.9.9-zeta"), 1)

    def test_tags_compared_as_text(self):
        self.assertEqual(compare("1.2.0-alpha", "1.2.0-beta"), -1)
        self.assertEqual(compare("1.2.0-rc2", "1.2.0-rc1"), 1)
        self.assertEqual(compare("1.2.0-rc10", "1.2.0-rc9"), -1)
        self.assertEqual(compare("1.2.0-RC", "1.2.0-rc"), -1)

    def test_equal_tags(self):
        self.assertEqual(compare("1.2.0-rc1", "1.2.0-rc1"), 0)
        self.assertEqual(compare("1.02.0-rc1", "1.2.0-rc1"), 0)

    def test_wrong_count_of_numbers(self):
        self.bad("1.2")
        self.bad("1.2.3.4")
        self.bad("7")

    def test_empty_part(self):
        self.bad("1..3")
        self.bad(".1.2")
        self.bad("1.2.")

    def test_letter_in_a_part(self):
        self.bad("1.x.0")
        self.bad("v1.2.3")

    def test_sign_or_space_in_a_part(self):
        self.bad("+1.2.3")
        self.bad("1. 2.3")
        self.bad("1.2.3 ")

    def test_empty_tag(self):
        self.bad("1.2.0-")

    def test_tag_with_other_characters(self):
        self.bad("1.2.0-rc.1")
        self.bad("1.2.0-rc 1")
        self.bad("1.2.0-rc_1")

    def test_empty_string(self):
        self.bad("")

    def test_bad_second_argument(self):
        with self.assertRaises(ValueError):
            compare("1.2.3", "1.2")
        with self.assertRaises(ValueError):
            compare("1.2.3", "1.x.0")

    def test_same_bad_text_twice(self):
        with self.assertRaises(ValueError):
            compare("1.2", "1.2")

    def test_type_error(self):
        for a, b in ((1, "1.0.0"), ("1.0.0", None), (1.5, 1.5), (b"1.0.0", "1.0.0")):
            with self.assertRaises(TypeError):
                compare(a, b)


if __name__ == "__main__":
    unittest.main()
