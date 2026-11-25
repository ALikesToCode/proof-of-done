import unittest

from luhn import check_digit, is_valid


class HiddenTests(unittest.TestCase):
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


    def test_more_valid(self):
        for number in ("00", "26", "34", "42", "67", "75", "83", "91", "4111-1111-1111-1111", "0 0 0"):
            self.assertTrue(is_valid(number))

    def test_more_invalid(self):
        for number in ("11", "4111-1111-1111-1112", "1 2", "9", "00a", "0x10", "+18", "1,8"):
            self.assertFalse(is_valid(number))

    def test_check_digit_makes_valid(self):
        for partial in ("0", "1", "123456", "99999", "4111 1111 1111 111", "000"):
            digit = check_digit(partial)
            self.assertEqual(len(digit), 1)
            self.assertTrue(is_valid(partial + digit))
        self.assertEqual(check_digit("0"), "0")
        self.assertEqual(check_digit("1"), "8")


if __name__ == "__main__":
    unittest.main()
