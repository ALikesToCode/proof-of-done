import unittest

from fractions import Fraction

from backoff import schedule


class HiddenTests(unittest.TestCase):
    def test_doubling(self):
        self.assertEqual(schedule(4, 100), [100, 200, 400])
        self.assertEqual(schedule(2, 7), [7])
        self.assertEqual(schedule(6, 1), [1, 2, 4, 8, 16])

    def test_one_attempt(self):
        self.assertEqual(schedule(1, 100), [])
        self.assertEqual(schedule(1, 100, factor=3, cap=5, budget=0), [])

    def test_factor(self):
        self.assertEqual(schedule(4, 100, factor=3), [100, 300, 900])
        self.assertEqual(schedule(4, 100, factor=1), [100, 100, 100])
        self.assertEqual(schedule(4, 5, factor=10), [5, 50, 500])

    def test_fraction_factor(self):
        self.assertEqual(schedule(4, 100, factor=Fraction(3, 2)), [100, 150, 225])
        self.assertEqual(schedule(4, 8, factor=Fraction(5, 2)), [8, 20, 50])
        self.assertEqual(schedule(3, 10, factor=Fraction(2, 1)), [10, 20])

    def test_rounded_down(self):
        self.assertEqual(schedule(5, 100, factor=Fraction(3, 2)), [100, 150, 225, 337])
        self.assertEqual(schedule(3, 10, factor=Fraction(19, 10)), [10, 19])
        self.assertEqual(schedule(2, 1, factor=Fraction(3, 2)), [1])
        self.assertEqual(schedule(3, 3, factor=Fraction(5, 3)), [3, 5])

    def test_rounding_is_not_carried(self):
        self.assertEqual(schedule(6, 100, factor=Fraction(3, 2)), [100, 150, 225, 337, 506])
        self.assertEqual(schedule(5, 10, factor=Fraction(4, 3)), [10, 13, 17, 23])
        self.assertEqual(schedule(5, 1, factor=Fraction(3, 2)), [1, 1, 2, 3])

    def test_delays_are_ints(self):
        for delays in (schedule(4, 100), schedule(6, 100, factor=Fraction(3, 2)),
                       schedule(4, 10, factor=Fraction(2, 1)), schedule(5, 100, factor=Fraction(3, 2), cap=200)):
            self.assertIs(type(delays), list)
            for delay in delays:
                self.assertIs(type(delay), int)

    def test_cap(self):
        self.assertEqual(schedule(5, 100, cap=350), [100, 200, 350, 350])
        self.assertEqual(schedule(5, 100, cap=200), [100, 200, 200, 200])
        self.assertEqual(schedule(4, 100, cap=1000), [100, 200, 400])
        self.assertEqual(schedule(3, 100, cap=30), [30, 30])
        self.assertEqual(schedule(5, 100, factor=Fraction(3, 2), cap=230), [100, 150, 225, 230])

    def test_budget_reached_exactly(self):
        self.assertEqual(schedule(10, 100, budget=700), [100, 200, 400])
        self.assertEqual(schedule(10, 100, budget=300), [100, 200])
        self.assertEqual(schedule(10, 100, budget=100), [100])

    def test_budget_is_never_exceeded(self):
        self.assertEqual(schedule(10, 100, budget=699), [100, 200])
        self.assertEqual(schedule(10, 100, budget=650), [100, 200])
        self.assertEqual(schedule(10, 100, budget=301), [100, 200])
        self.assertEqual(schedule(10, 100, budget=299), [100])
        self.assertEqual(schedule(10, 100, factor=3, budget=1299), [100, 300])

    def test_budget_below_the_first_delay(self):
        self.assertEqual(schedule(5, 100, budget=99), [])
        self.assertEqual(schedule(5, 100, budget=0), [])
        self.assertEqual(schedule(5, 100, cap=40, budget=39), [])

    def test_budget_that_is_not_reached(self):
        self.assertEqual(schedule(3, 100, budget=10000), [100, 200])
        self.assertEqual(schedule(3, 100, budget=300), [100, 200])

    def test_cap_before_budget(self):
        self.assertEqual(schedule(10, 100, cap=150, budget=400), [100, 150, 150])
        self.assertEqual(schedule(6, 100, cap=150, budget=700), [100, 150, 150, 150, 150])
        self.assertEqual(schedule(10, 100, cap=50, budget=200), [50, 50, 50, 50])

    def test_cap_with_a_budget_between_sums(self):
        self.assertEqual(schedule(10, 100, cap=150, budget=399), [100, 150])
        self.assertEqual(schedule(10, 100, cap=150, budget=549), [100, 150, 150])

    def test_no_limit_on_attempts(self):
        self.assertEqual(schedule(None, 100, budget=700), [100, 200, 400])
        self.assertEqual(schedule(None, 100, cap=100, budget=500), [100, 100, 100, 100, 100])
        self.assertEqual(schedule(None, 1, factor=1, budget=3), [1, 1, 1])
        self.assertEqual(schedule(None, 100, budget=0), [])

    def test_no_limit_on_attempts_stays_within_budget(self):
        self.assertEqual(schedule(None, 100, budget=1000), [100, 200, 400])
        self.assertEqual(schedule(None, 100, cap=300, budget=1000), [100, 200, 300, 300])
        self.assertEqual(schedule(None, 100, budget=50), [])

    def test_no_limit_needs_a_budget(self):
        with self.assertRaises(ValueError):
            schedule(None, 100)
        with self.assertRaises(ValueError):
            schedule(None, 100, factor=3, cap=500)

    def test_bad_arguments(self):
        for arguments in ((0, 100), (-1, 100), (3, 0), (3, -5)):
            with self.assertRaises(ValueError):
                schedule(*arguments)
        for factor in (0, -2, Fraction(1, 2), Fraction(99, 100)):
            with self.assertRaises(ValueError):
                schedule(3, 100, factor=factor)
        for cap in (0, -1):
            with self.assertRaises(ValueError):
                schedule(3, 100, cap=cap)
        with self.assertRaises(ValueError):
            schedule(3, 100, budget=-1)
        with self.assertRaises(ValueError):
            schedule(None, 100, budget=-1)

    def test_smallest_valid_arguments(self):
        self.assertEqual(schedule(3, 1, factor=1, cap=1, budget=0), [])
        self.assertEqual(schedule(3, 1, factor=1, cap=1, budget=2), [1, 1])


if __name__ == "__main__":
    unittest.main()
