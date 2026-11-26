import unittest

from temperature import convert


class VisibleTests(unittest.TestCase):
    def test_celsius_to_fahrenheit(self):
        self.assertAlmostEqual(convert(100, "C", "F"), 212)

    def test_fahrenheit_to_celsius(self):
        self.assertAlmostEqual(convert(32, "F", "C"), 0)

    def test_celsius_to_kelvin(self):
        self.assertAlmostEqual(convert(0, "C", "K"), 273.15)

    def test_kelvin_to_celsius(self):
        self.assertAlmostEqual(convert(300, "K", "C"), 26.85)

    def test_below_absolute_zero(self):
        with self.assertRaises(ValueError):
            convert(-1, "K", "C")

    def test_unknown_unit(self):
        with self.assertRaises(ValueError):
            convert(1, "C", "R")


if __name__ == "__main__":
    unittest.main()
