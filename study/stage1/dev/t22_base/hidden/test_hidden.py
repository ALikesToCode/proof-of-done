import unittest

from base import from_base, to_base


class HiddenTests(unittest.TestCase):
    def test_to_base(self):
        self.assertEqual(to_base(255, 16), "ff")
        self.assertEqual(to_base(0, 2), "0")
        self.assertEqual(to_base(-10, 2), "-1010")
        self.assertEqual(to_base(35, 36), "z")
        self.assertEqual(to_base(36, 36), "10")

    def test_from_base(self):
        self.assertEqual(from_base("ff", 16), 255)
        self.assertEqual(from_base("FF", 16), 255)
        self.assertEqual(from_base("-1010", 2), -10)
        self.assertEqual(from_base("0", 7), 0)

    def test_bad_base(self):
        for base in (1, 0, 37, -2):
            with self.assertRaises(ValueError):
                to_base(5, base)
            with self.assertRaises(ValueError):
                from_base("1", base)

    def test_bad_text(self):
        for text, base in (("", 10), ("-", 10), ("12", 2), ("g", 16), ("1 0", 2), (" 1", 2), ("+1", 10), ("1.5", 10), ("--1", 10)):
            with self.assertRaises(ValueError):
                from_base(text, base)


    def test_round_trip(self):
        for base in (2, 3, 8, 10, 16, 36):
            for number in (0, 1, -1, 7, 12345, -98765, 36 ** 5):
                self.assertEqual(from_base(to_base(number, base), base), number)

    def test_more_values(self):
        self.assertEqual(to_base(10, 10), "10")
        self.assertEqual(to_base(-255, 16), "-ff")
        self.assertEqual(to_base(2 ** 64, 2), "1" + "0" * 64)
        self.assertEqual(from_base("Zz", 36), 35 * 36 + 35)

    def test_more_bad_text(self):
        for text, base in (("9", 9), ("z", 35), ("a", 10), ("1-", 10), ("1_0", 10), ("0x1f", 16)):
            with self.assertRaises(ValueError):
                from_base(text, base)


if __name__ == "__main__":
    unittest.main()
