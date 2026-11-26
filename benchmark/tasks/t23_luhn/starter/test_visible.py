import unittest

from luhn import check_digit, is_valid


class VisibleTests(unittest.TestCase):
    def test_valid(self):
        for number in ("4539 3195 0343 6467", "79927398713", "0000-0000", "59", "18"):
            self.assertTrue(is_valid(number))

    def test_invalid(self):
        for number in ("4539 3195 0343 6468", "79927398710", "", "0", "5", "12a4", "12.34", " ", "--", "１８"):
            self.assertFalse(is_valid(number))

    def test_check_digit(self):
        self.assertEqual(check_digit("7992739871"), "3")
        self.assertEqual(check_digit("5"), "9")
        self.assertEqual(check_digit("4539 3195 0343 646"), "7")

    def test_check_digit_bad(self):
        for text in ("", " ", "12a", "-", "1.2"):
            with self.assertRaises(ValueError):
                check_digit(text)


if __name__ == "__main__":
    unittest.main()
