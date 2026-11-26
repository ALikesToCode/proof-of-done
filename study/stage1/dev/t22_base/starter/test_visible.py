import unittest

from base import from_base, to_base


class VisibleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
