import unittest

from datetime import date

from workdays import working_days_between


class VisibleTests(unittest.TestCase):
    def test_same_day_is_zero(self):
        self.assertEqual(working_days_between(date(2026, 11, 2), date(2026, 11, 2)), 0)

    def test_within_one_week(self):
        self.assertEqual(working_days_between(date(2026, 11, 2), date(2026, 11, 5)), 3)

    def test_skips_the_weekend(self):
        self.assertEqual(working_days_between(date(2026, 11, 6), date(2026, 11, 9)), 1)

    def test_full_week(self):
        self.assertEqual(working_days_between(date(2026, 11, 2), date(2026, 11, 9)), 5)

    def test_rejects_reversed(self):
        with self.assertRaises(ValueError):
            working_days_between(date(2026, 11, 9), date(2026, 11, 2))

    def test_holiday_in_the_week(self):
        self.assertEqual(working_days_between(date(2026, 11, 2), date(2026, 11, 9), [date(2026, 11, 4)]), 4)


if __name__ == "__main__":
    unittest.main()
