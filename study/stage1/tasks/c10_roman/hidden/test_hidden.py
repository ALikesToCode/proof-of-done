import unittest

from roman import to_roman


class HiddenTests(unittest.TestCase):
    def test_additive(self):
        for number, text in ((1, "I"), (2, "II"), (3, "III"), (6, "VI"), (8, "VIII"), (15, "XV"), (2000, "MM"), (1666, "MDCLXVI")):
            self.assertEqual(to_roman(number), text)

    def test_subtractive_forms(self):
        for number, text in ((4, "IV"), (9, "IX"), (40, "XL"), (90, "XC"), (400, "CD"), (900, "CM")):
            self.assertEqual(to_roman(number), text)

    def test_never_four_equal_letters_in_a_row(self):
        for number in range(1, 4000):
            text = to_roman(number)
            for letter in "IXCM":
                self.assertNotIn(letter * 4, text)

    def test_digit_by_digit(self):
        for number, text in ((1994, "MCMXCIV"), (14, "XIV"), (444, "CDXLIV"), (1990, "MCMXC"), (2024, "MMXXIV"), (3888, "MMMDCCCLXXXVIII")):
            self.assertEqual(to_roman(number), text)

    def test_no_other_subtractive_forms(self):
        for number, text in ((49, "XLIX"), (99, "XCIX"), (999, "CMXCIX"), (45, "XLV"), (1999, "MCMXCIX")):
            self.assertEqual(to_roman(number), text)

    def test_range_ends(self):
        self.assertEqual(to_roman(1), "I")
        self.assertEqual(to_roman(3999), "MMMCMXCIX")

    def test_zero_and_negative(self):
        for number in (0, -1, -3):
            with self.assertRaises(ValueError):
                to_roman(number)

    def test_4000(self):
        with self.assertRaises(ValueError):
            to_roman(4000)

    def test_far_above_the_range(self):
        for number in (4001, 5000, 10000):
            with self.assertRaises(ValueError):
                to_roman(number)

    def test_float_is_a_type_error(self):
        for number in (4.0, 3.5):
            with self.assertRaises(TypeError):
                to_roman(number)

    def test_str_and_none_are_type_errors(self):
        for number in ("4", "IV", None):
            with self.assertRaises(TypeError):
                to_roman(number)

    def test_bool_is_a_type_error(self):
        for number in (True, False):
            with self.assertRaises(TypeError):
                to_roman(number)


if __name__ == "__main__":
    unittest.main()
