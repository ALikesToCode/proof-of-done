import unittest

import durations


class VisibleTests(unittest.TestCase):
    def test_formats_hours_and_minutes(self):
        self.assertEqual(durations.format_duration(5400), "1h30m")

    def test_formats_zero(self):
        self.assertEqual(durations.format_duration(0), "0s")

    def test_parses_combined(self):
        self.assertEqual(durations.parse_duration("1h30m"), 5400)

    def test_parses_single_units(self):
        self.assertEqual(durations.parse_duration("45s"), 45)
        self.assertEqual(durations.parse_duration("2h"), 7200)

    def test_rejects_unknown_unit(self):
        with self.assertRaises(ValueError):
            durations.parse_duration("10x")


if __name__ == "__main__":
    unittest.main()
