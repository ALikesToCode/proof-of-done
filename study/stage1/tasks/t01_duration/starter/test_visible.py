import unittest

from duration import parse_duration


class VisibleTests(unittest.TestCase):
    def test_seconds(self):
        self.assertEqual(parse_duration("90s"), 90000)

    def test_two_components(self):
        self.assertEqual(parse_duration("1h30m"), 5400000)

    def test_space_between_components(self):
        self.assertEqual(parse_duration("1h 30m"), 5400000)

    def test_fraction(self):
        self.assertEqual(parse_duration("1.5h"), 5400000)

    def test_garbage(self):
        with self.assertRaises(ValueError):
            parse_duration("abc")


if __name__ == "__main__":
    unittest.main()
