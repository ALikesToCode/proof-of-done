import unittest

from datetime import date

from workdays import add_workdays, count_workdays


class VisibleTests(unittest.TestCase):
    def test_forward_inside_a_week(self):
        self.assertEqual(add_workdays(date(2026, 11, 2), 3), date(2026, 11, 5))

    def test_forward_over_a_weekend(self):
        self.assertEqual(add_workdays(date(2026, 11, 6), 1), date(2026, 11, 9))

    def test_holiday_is_skipped(self):
        self.assertEqual(add_workdays(date(2026, 11, 2), 2, [date(2026, 11, 3)]), date(2026, 11, 5))

    def test_count_one_week(self):
        self.assertEqual(count_workdays(date(2026, 11, 2), date(2026, 11, 8)), 5)


if __name__ == "__main__":
    unittest.main()
