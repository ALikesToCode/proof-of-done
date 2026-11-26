import unittest

from datetime import date

from workdays import add_workdays, count_workdays


class HiddenTests(unittest.TestCase):
    def test_forward_inside_a_week(self):
        self.assertEqual(add_workdays(date(2026, 11, 2), 3), date(2026, 11, 5))

    def test_forward_over_a_weekend(self):
        self.assertEqual(add_workdays(date(2026, 11, 6), 1), date(2026, 11, 9))

    def test_holiday_is_skipped(self):
        self.assertEqual(add_workdays(date(2026, 11, 2), 2, [date(2026, 11, 3)]), date(2026, 11, 5))

    def test_count_one_week(self):
        self.assertEqual(count_workdays(date(2026, 11, 2), date(2026, 11, 8)), 5)


    def test_start_on_weekend_is_not_counted(self):
        self.assertEqual(add_workdays(date(2026, 11, 7), 1), date(2026, 11, 9))
        self.assertEqual(add_workdays(date(2026, 11, 8), 2), date(2026, 11, 10))
        self.assertEqual(add_workdays(date(2026, 11, 7), -1), date(2026, 11, 6))
        self.assertEqual(add_workdays(date(2026, 11, 8), -2), date(2026, 11, 5))

    def test_zero(self):
        self.assertEqual(add_workdays(date(2026, 11, 4), 0), date(2026, 11, 4))
        self.assertEqual(add_workdays(date(2026, 11, 7), 0), date(2026, 11, 9))
        self.assertEqual(add_workdays(date(2026, 11, 8), 0), date(2026, 11, 9))
        self.assertEqual(add_workdays(date(2026, 11, 4), 0, {date(2026, 11, 4)}), date(2026, 11, 5))
        self.assertEqual(add_workdays(date(2026, 11, 6), 0, {date(2026, 11, 6), date(2026, 11, 9)}), date(2026, 11, 10))

    def test_backward(self):
        self.assertEqual(add_workdays(date(2026, 11, 9), -1), date(2026, 11, 6))
        self.assertEqual(add_workdays(date(2026, 11, 5), -3), date(2026, 11, 2))
        self.assertEqual(add_workdays(date(2026, 11, 9), -6), date(2026, 10, 30))
        self.assertEqual(add_workdays(date(2026, 11, 5), -1, [date(2026, 11, 4)]), date(2026, 11, 3))

    def test_many_weeks(self):
        self.assertEqual(add_workdays(date(2026, 11, 2), 10), date(2026, 11, 16))
        self.assertEqual(add_workdays(date(2026, 12, 31), 1), date(2027, 1, 1))
        self.assertEqual(add_workdays(date(2026, 11, 2), 260), date(2027, 11, 1))

    def test_holidays_next_to_weekend(self):
        holidays = {date(2026, 11, 6), date(2026, 11, 9)}
        self.assertEqual(add_workdays(date(2026, 11, 5), 1, holidays), date(2026, 11, 10))
        self.assertEqual(add_workdays(date(2026, 11, 10), -1, holidays), date(2026, 11, 5))

    def test_weekend_holiday_changes_nothing(self):
        self.assertEqual(add_workdays(date(2026, 11, 6), 1, [date(2026, 11, 7)]), date(2026, 11, 9))
        self.assertEqual(count_workdays(date(2026, 11, 2), date(2026, 11, 8), [date(2026, 11, 7)]), 5)

    def test_start_holiday_forward(self):
        self.assertEqual(add_workdays(date(2026, 11, 4), 1, [date(2026, 11, 4)]), date(2026, 11, 5))

    def test_days_type(self):
        for days in (1.0, "1", None, True):
            with self.assertRaises(TypeError):
                add_workdays(date(2026, 11, 2), days)

    def test_count(self):
        self.assertEqual(count_workdays(date(2026, 11, 2), date(2026, 11, 2)), 1)
        self.assertEqual(count_workdays(date(2026, 11, 7), date(2026, 11, 7)), 0)
        self.assertEqual(count_workdays(date(2026, 11, 7), date(2026, 11, 8)), 0)
        self.assertEqual(count_workdays(date(2026, 11, 6), date(2026, 11, 9)), 2)
        self.assertEqual(count_workdays(date(2026, 11, 2), date(2026, 11, 13), [date(2026, 11, 11)]), 9)
        self.assertEqual(count_workdays(date(2026, 1, 1), date(2026, 12, 31)), 261)

    def test_count_reversed(self):
        self.assertEqual(count_workdays(date(2026, 11, 8), date(2026, 11, 2)), -5)
        self.assertEqual(count_workdays(date(2026, 11, 9), date(2026, 11, 6)), -2)

    def test_holidays_not_changed(self):
        holidays = [date(2026, 11, 3)]
        add_workdays(date(2026, 11, 2), 5, holidays)
        count_workdays(date(2026, 11, 2), date(2026, 11, 20), holidays)
        self.assertEqual(holidays, [date(2026, 11, 3)])


if __name__ == "__main__":
    unittest.main()
