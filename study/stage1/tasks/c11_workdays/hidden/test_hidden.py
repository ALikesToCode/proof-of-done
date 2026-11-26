import unittest

from datetime import date

from workdays import working_days_between

MON = date(2026, 11, 2)
WED = date(2026, 11, 4)
THU = date(2026, 11, 5)
FRI = date(2026, 11, 6)
SAT = date(2026, 11, 7)
SUN = date(2026, 11, 8)
NEXT_MON = date(2026, 11, 9)
NEXT_TUE = date(2026, 11, 10)


class HiddenTests(unittest.TestCase):
    def test_within_one_week(self):
        self.assertEqual(working_days_between(MON, THU), 3)

    def test_skips_the_weekend(self):
        self.assertEqual(working_days_between(FRI, NEXT_MON), 1)

    def test_full_week(self):
        self.assertEqual(working_days_between(MON, NEXT_MON), 5)

    def test_two_weeks(self):
        self.assertEqual(working_days_between(MON, date(2026, 11, 16)), 10)

    def test_weekend_only(self):
        self.assertEqual(working_days_between(SAT, NEXT_MON), 0)
        self.assertEqual(working_days_between(SAT, SUN), 0)

    def test_start_on_a_sunday(self):
        self.assertEqual(working_days_between(SUN, NEXT_TUE), 1)

    def test_start_counted_end_not(self):
        self.assertEqual(working_days_between(THU, FRI), 1)
        self.assertEqual(working_days_between(FRI, SAT), 1)
        self.assertEqual(working_days_between(SUN, NEXT_MON), 0)

    def test_same_day_is_zero(self):
        self.assertEqual(working_days_between(MON, MON), 0)
        self.assertEqual(working_days_between(SAT, SAT), 0)

    def test_result_is_int(self):
        self.assertIs(type(working_days_between(MON, NEXT_MON)), int)
        self.assertIs(type(working_days_between(MON, NEXT_MON, [WED])), int)

    def test_a_whole_year(self):
        self.assertEqual(working_days_between(date(2026, 1, 1), date(2027, 1, 1)), 261)

    def test_rejects_reversed(self):
        with self.assertRaises(ValueError):
            working_days_between(NEXT_MON, MON)
        with self.assertRaises(ValueError):
            working_days_between(SUN, SAT)
        with self.assertRaises(ValueError):
            working_days_between(NEXT_MON, MON, [WED])

    def test_holiday_lowers_the_count(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, [WED]), 4)
        self.assertEqual(working_days_between(MON, NEXT_MON, [WED, FRI]), 3)

    def test_holidays_as_other_iterables(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, (WED, THU)), 3)
        self.assertEqual(working_days_between(MON, NEXT_MON, {WED, THU}), 3)
        self.assertEqual(working_days_between(MON, NEXT_MON, (day for day in [WED, THU])), 3)

    def test_holiday_on_a_weekend_changes_nothing(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, [SAT]), 5)
        self.assertEqual(working_days_between(MON, NEXT_MON, [SUN, WED]), 4)

    def test_holiday_listed_twice_counts_once(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, [WED, WED]), 4)
        self.assertEqual(working_days_between(MON, NEXT_MON, (WED, THU, WED)), 3)

    def test_holiday_outside_the_range(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, [NEXT_TUE]), 5)
        self.assertEqual(working_days_between(MON, NEXT_MON, [date(2026, 10, 30)]), 5)

    def test_holiday_on_the_ends(self):
        self.assertEqual(working_days_between(MON, NEXT_MON, [NEXT_MON]), 5)
        self.assertEqual(working_days_between(MON, NEXT_MON, [MON]), 4)


if __name__ == "__main__":
    unittest.main()
