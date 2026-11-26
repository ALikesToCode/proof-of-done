import unittest

from datetime import date

from daterange import count_dates, dates_between


class VisibleTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 3)), [date(2026, 3, 1), date(2026, 3, 2), date(2026, 3, 3)])

    def test_step(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 5), 2), [date(2026, 3, 1), date(2026, 3, 3), date(2026, 3, 5)])

    def test_count(self):
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 3)), 3)


if __name__ == "__main__":
    unittest.main()
