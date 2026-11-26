import unittest

from datetime import date

from months import add_months, months_between


class VisibleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
