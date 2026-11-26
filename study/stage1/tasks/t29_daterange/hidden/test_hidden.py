import unittest

from datetime import date

from daterange import count_dates, dates_between


class HiddenTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 3)), [date(2026, 3, 1), date(2026, 3, 2), date(2026, 3, 3)])

    def test_step(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 5), 2), [date(2026, 3, 1), date(2026, 3, 3), date(2026, 3, 5)])

    def test_count(self):
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 3)), 3)


    def test_single_day(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 1)), [date(2026, 3, 1)])
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 1), 7), [date(2026, 3, 1)])
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 1)), 1)
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 1), 30), 1)

    def test_step_passes_the_end(self):
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 6), 2), [date(2026, 3, 1), date(2026, 3, 3), date(2026, 3, 5)])
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 3, 4), 10), [date(2026, 3, 1)])
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 6), 2), 3)
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 5), 2), 3)
        self.assertEqual(count_dates(date(2026, 3, 1), date(2026, 3, 4), 10), 1)

    def test_backward(self):
        self.assertEqual(dates_between(date(2026, 3, 3), date(2026, 3, 1)), [date(2026, 3, 3), date(2026, 3, 2), date(2026, 3, 1)])
        self.assertEqual(dates_between(date(2026, 3, 6), date(2026, 3, 1), 2), [date(2026, 3, 6), date(2026, 3, 4), date(2026, 3, 2)])
        self.assertEqual(dates_between(date(2026, 3, 1), date(2026, 2, 27)), [date(2026, 3, 1), date(2026, 2, 28), date(2026, 2, 27)])
        self.assertEqual(count_dates(date(2026, 3, 3), date(2026, 3, 1)), 3)
        self.assertEqual(count_dates(date(2026, 3, 6), date(2026, 3, 1), 2), 3)
        self.assertEqual(count_dates(date(2026, 3, 7), date(2026, 3, 1), 2), 4)

    def test_month_and_year_edges(self):
        self.assertEqual(len(dates_between(date(2028, 2, 27), date(2028, 3, 1))), 4)
        self.assertEqual(dates_between(date(2026, 12, 31), date(2027, 1, 1)), [date(2026, 12, 31), date(2027, 1, 1)])
        self.assertEqual(count_dates(date(2026, 1, 1), date(2026, 12, 31)), 365)
        self.assertEqual(count_dates(date(2026, 1, 1), date(2026, 12, 31), 7), 53)

    def test_bad_step(self):
        for step in (0, -1, 1.5, "2", None):
            with self.assertRaises(ValueError):
                dates_between(date(2026, 3, 1), date(2026, 3, 3), step)
            with self.assertRaises(ValueError):
                count_dates(date(2026, 3, 1), date(2026, 3, 3), step)

    def test_count_matches_the_list(self):
        days = [date(2026, 1, 1), date(2026, 1, 2), date(2026, 1, 9), date(2026, 2, 1), date(2025, 12, 25)]
        for start in days:
            for end in days:
                for step in (1, 2, 3, 7, 40):
                    self.assertEqual(count_dates(start, end, step), len(dates_between(start, end, step)))

    def test_count_is_fast(self):
        import time
        started = time.perf_counter()
        self.assertEqual(count_dates(date(1, 1, 1), date(9999, 12, 31)), 3652059)
        self.assertEqual(count_dates(date(9999, 12, 31), date(1, 1, 1), 2), 1826030)
        self.assertLess(time.perf_counter() - started, 0.5)

    def test_result_types(self):
        result = dates_between(date(2026, 3, 1), date(2026, 3, 2))
        self.assertIsInstance(result, list)
        self.assertIs(type(count_dates(date(2026, 3, 1), date(2026, 3, 2))), int)


if __name__ == "__main__":
    unittest.main()
