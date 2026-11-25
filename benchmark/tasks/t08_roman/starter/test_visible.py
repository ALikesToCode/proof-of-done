import unittest

from roman import from_roman, to_roman


class VisibleTests(unittest.TestCase):
    def test_known_values(self):
        for number, text in ((1, "I"), (4, "IV"), (9, "IX"), (14, "XIV"), (40, "XL"), (90, "XC"),
                             (400, "CD"), (900, "CM"), (1994, "MCMXCIV"), (3999, "MMMCMXCIX")):
            self.assertEqual(to_roman(number), text)
            self.assertEqual(from_roman(text), number)

    def test_round_trip(self):
        for number in range(1, 4000):
            self.assertEqual(from_roman(to_roman(number)), number)

    def test_out_of_range(self):
        for number in (0, -1, 4000):
            with self.assertRaises(ValueError):
                to_roman(number)

    def test_invalid_numerals(self):
        for text in ("", "iv", "IIII", "VX", "IC", "MMMM", "ABC", "X I"):
            with self.assertRaises(ValueError):
                from_roman(text)


if __name__ == "__main__":
    unittest.main()
