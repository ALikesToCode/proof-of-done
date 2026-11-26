import unittest

from temperature import convert


class HiddenTests(unittest.TestCase):
    def test_celsius_and_fahrenheit(self):
        self.assertEqual(convert(100, "C", "F"), 212.0)
        self.assertEqual(convert(-40, "C", "F"), -40.0)
        self.assertEqual(convert(32, "F", "C"), 0.0)
        self.assertEqual(convert(77, "F", "C"), 25.0)

    def test_celsius_and_kelvin(self):
        self.assertEqual(convert(0, "C", "K"), 273.15)
        self.assertEqual(convert(273.15, "K", "C"), 0.0)

    def test_fahrenheit_and_kelvin(self):
        self.assertEqual(convert(212, "F", "K"), 373.15)
        self.assertEqual(convert(273.15, "K", "F"), 32.0)

    def test_result_is_a_float(self):
        self.assertIs(type(convert(0, "C", "K")), float)
        self.assertIs(type(convert(100, "C", "F")), float)
        self.assertIs(type(convert(32, "F", "C")), float)

    def test_rounded_to_two_places(self):
        self.assertEqual(convert(300, "K", "C"), 26.85)
        self.assertEqual(convert(0, "F", "K"), 255.37)
        self.assertEqual(convert(451, "F", "K"), 505.93)
        self.assertEqual(convert(0, "K", "F"), -459.67)

    def test_same_unit(self):
        result = convert(20, "C", "C")
        self.assertEqual(result, 20.0)
        self.assertIs(type(result), float)
        self.assertEqual(convert(1.234, "K", "K"), 1.23)
        self.assertEqual(convert(-12.5, "F", "F"), -12.5)

    def test_same_unit_is_still_checked(self):
        with self.assertRaises(ValueError):
            convert(-1, "K", "K")
        with self.assertRaises(ValueError):
            convert(-300, "C", "C")
        with self.assertRaises(ValueError):
            convert(1, "X", "X")

    def test_unknown_unit(self):
        for source, target in (("C", "R"), ("R", "C"), ("C", ""), ("Celsius", "F")):
            with self.assertRaises(ValueError):
                convert(1, source, target)

    def test_units_are_case_sensitive(self):
        for source, target in (("k", "C"), ("C", "f"), ("c", "K")):
            with self.assertRaises(ValueError):
                convert(1, source, target)

    def test_below_absolute_zero(self):
        for value, source, target in ((-1, "K", "C"), (-0.01, "K", "F"), (-300, "C", "K"), (-273.16, "C", "F"), (-500, "F", "C"), (-459.68, "F", "K")):
            with self.assertRaises(ValueError):
                convert(value, source, target)

    def test_absolute_zero_is_allowed(self):
        self.assertEqual(convert(-273.15, "C", "K"), 0.0)
        self.assertEqual(convert(0, "K", "C"), -273.15)
        self.assertEqual(convert(-459.67, "F", "K"), 0.0)
        self.assertEqual(convert(0, "K", "K"), 0.0)


if __name__ == "__main__":
    unittest.main()
