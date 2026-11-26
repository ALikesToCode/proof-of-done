import unittest

from roman import to_roman


class VisibleTests(unittest.TestCase):
    def test_small_numbers(self):
        self.assertEqual(to_roman(3), "III")
        self.assertEqual(to_roman(6), "VI")

    def test_large_number(self):
        self.assertEqual(to_roman(2000), "MM")

    def test_subtractive(self):
        self.assertEqual(to_roman(4), "IV")
        self.assertEqual(to_roman(9), "IX")
        self.assertEqual(to_roman(40), "XL")

    def test_year(self):
        self.assertEqual(to_roman(1994), "MCMXCIV")

    def test_rejects_zero(self):
        with self.assertRaises(ValueError):
            to_roman(0)


if __name__ == "__main__":
    unittest.main()
