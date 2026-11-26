import unittest

from datetime import date

from months import add_months, months_between


class HiddenTests(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(add_months(date(2026, 3, 15), 1), date(2026, 4, 15))
        self.assertEqual(add_months(date(2026, 3, 15), 12), date(2027, 3, 15))

    def test_year_rollover(self):
        self.assertEqual(add_months(date(2026, 11, 15), 3), date(2027, 2, 15))

    def test_clamp(self):
        self.assertEqual(add_months(date(2026, 1, 31), 1), date(2026, 2, 28))

    def test_between(self):
        self.assertEqual(months_between(date(2026, 1, 15), date(2026, 4, 15)), 3)
        self.assertEqual(months_between(date(2026, 1, 15), date(2026, 4, 14)), 2)


    def test_leap_years(self):
        self.assertEqual(add_months(date(2028, 1, 31), 1), date(2028, 2, 29))
        self.assertEqual(add_months(date(2028, 2, 29), 12), date(2029, 2, 28))
        self.assertEqual(add_months(date(2028, 2, 29), 48), date(2032, 2, 29))
        self.assertEqual(add_months(date(2099, 3, 31), 11), date(2100, 2, 28))
        self.assertEqual(add_months(date(1999, 3, 30), 11), date(2000, 2, 29))

    def test_thirty_day_months(self):
        self.assertEqual(add_months(date(2026, 3, 31), 1), date(2026, 4, 30))
        self.assertEqual(add_months(date(2026, 5, 31), 4), date(2026, 9, 30))
        self.assertEqual(add_months(date(2026, 8, 31), 3), date(2026, 11, 30))

    def test_clamping_is_not_remembered(self):
        self.assertEqual(add_months(add_months(date(2026, 1, 31), 1), 1), date(2026, 3, 28))
        self.assertEqual(add_months(date(2026, 2, 28), 1), date(2026, 3, 28))

    def test_negative(self):
        self.assertEqual(add_months(date(2026, 3, 31), -1), date(2026, 2, 28))
        self.assertEqual(add_months(date(2026, 1, 15), -1), date(2025, 12, 15))
        self.assertEqual(add_months(date(2026, 1, 15), -13), date(2024, 12, 15))
        self.assertEqual(add_months(date(2026, 12, 31), -12), date(2025, 12, 31))
        self.assertEqual(add_months(date(2028, 3, 31), -1), date(2028, 2, 29))

    def test_zero_and_december(self):
        self.assertEqual(add_months(date(2026, 5, 31), 0), date(2026, 5, 31))
        self.assertEqual(add_months(date(2026, 12, 15), 1), date(2027, 1, 15))
        self.assertEqual(add_months(date(2026, 1, 15), 11), date(2026, 12, 15))
        self.assertEqual(add_months(date(2026, 12, 31), 12), date(2027, 12, 31))
        self.assertEqual(add_months(date(2026, 11, 30), 1), date(2026, 12, 30))

    def test_types(self):
        for months in (1.0, "1", None, True):
            with self.assertRaises(TypeError):
                add_months(date(2026, 1, 1), months)

    def test_out_of_range(self):
        with self.assertRaises(ValueError):
            add_months(date(9999, 12, 1), 1)
        with self.assertRaises(ValueError):
            add_months(date(1, 1, 1), -1)

    def test_between_end_of_month(self):
        self.assertEqual(months_between(date(2026, 1, 31), date(2026, 2, 28)), 1)
        self.assertEqual(months_between(date(2026, 1, 31), date(2026, 2, 27)), 0)
        self.assertEqual(months_between(date(2026, 1, 31), date(2026, 3, 30)), 1)
        self.assertEqual(months_between(date(2026, 1, 31), date(2026, 3, 31)), 2)
        self.assertEqual(months_between(date(2026, 2, 28), date(2026, 3, 28)), 1)
        self.assertEqual(months_between(date(2026, 2, 28), date(2026, 3, 27)), 0)
        self.assertEqual(months_between(date(2028, 2, 29), date(2029, 2, 28)), 12)

    def test_between_same_and_long(self):
        self.assertEqual(months_between(date(2026, 5, 5), date(2026, 5, 5)), 0)
        self.assertEqual(months_between(date(2026, 5, 5), date(2026, 6, 4)), 0)
        self.assertEqual(months_between(date(2000, 1, 1), date(2026, 1, 1)), 312)
        self.assertEqual(months_between(date(2025, 12, 15), date(2026, 1, 15)), 1)

    def test_between_reversed(self):
        self.assertEqual(months_between(date(2026, 4, 15), date(2026, 1, 15)), -3)
        self.assertEqual(months_between(date(2026, 2, 28), date(2026, 1, 31)), -1)
        self.assertEqual(months_between(date(2026, 2, 27), date(2026, 1, 31)), 0)
        self.assertEqual(months_between(date(2026, 3, 31), date(2026, 2, 28)), -1)


if __name__ == "__main__":
    unittest.main()
