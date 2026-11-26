import unittest

from roman import from_roman, to_roman

ONES = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"]
TENS = ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"]
HUNDREDS = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"]
THOUSANDS = ["", "M", "MM", "MMM"]


def expected(number):
    return THOUSANDS[number // 1000] + HUNDREDS[number // 100 % 10] + TENS[number // 10 % 10] + ONES[number % 10]


class HiddenTests(unittest.TestCase):
    def test_every_number(self):
        for number in range(1, 4000):
            text = expected(number)
            self.assertEqual(to_roman(number), text)
            self.assertEqual(from_roman(text), number)

    def test_out_of_range(self):
        for number in (0, -1, -3999, 4000, 10000):
            with self.assertRaises(ValueError):
                to_roman(number)

    def test_invalid_numerals(self):
        for text in ("", "iv", "Iv", "IIII", "VV", "VX", "IC", "IL", "XM", "MMMM", "ABC", "X I", " X", "X ",
                     "IIV", "IXI", "XCX", "CMC", "LL", "DD", "CCCC", "XXXX", "IVI", "12", "MCMC"):
            with self.assertRaises(ValueError):
                from_roman(text)


if __name__ == "__main__":
    unittest.main()
