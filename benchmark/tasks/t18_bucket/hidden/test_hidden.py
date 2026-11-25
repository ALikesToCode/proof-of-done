import unittest

from fractions import Fraction

from bucket import TokenBucket


class HiddenTests(unittest.TestCase):
    def setUp(self):
        self.now = 0

    def clock(self):
        return self.now

    def test_starts_full(self):
        bucket = TokenBucket(1, 3, clock=self.clock)
        self.assertTrue(bucket.take())
        self.assertTrue(bucket.take())
        self.assertTrue(bucket.take())
        self.assertFalse(bucket.take())

    def test_refills(self):
        bucket = TokenBucket(1, 1, clock=self.clock)
        self.assertTrue(bucket.take())
        self.assertFalse(bucket.take())
        self.now = 1
        self.assertTrue(bucket.take())

    def test_bad_arguments(self):
        with self.assertRaises(ValueError):
            TokenBucket(0, 1)


    def test_cap(self):
        bucket = TokenBucket(2, 5, clock=self.clock)
        self.now = 100
        self.assertEqual(bucket.available(), 5)
        self.assertTrue(bucket.take(5))
        self.assertEqual(bucket.available(), 0)
        self.now = 101
        self.assertEqual(bucket.available(), 2)
        self.now = 1000
        self.assertEqual(bucket.available(), 5)

    def test_time_spent_full_is_not_saved(self):
        bucket = TokenBucket(1, 2, clock=self.clock)
        self.now = 50
        self.assertTrue(bucket.take(2))
        self.assertFalse(bucket.take(1))
        self.now = 51
        self.assertEqual(bucket.available(), 1)

    def test_exact_boundary(self):
        bucket = TokenBucket(Fraction(1, 3), 2, clock=self.clock)
        self.assertTrue(bucket.take(2))
        self.now = 3
        self.assertEqual(bucket.available(), 1)
        self.assertTrue(bucket.take(1))
        self.now = Fraction(17, 3)
        self.assertFalse(bucket.take(1))
        self.now = 6
        self.assertTrue(bucket.take(1))

    def test_exact_tenths(self):
        bucket = TokenBucket(Fraction(1, 10), 1, clock=self.clock)
        self.assertTrue(bucket.take())
        for step in range(1, 10):
            self.now = step
            self.assertFalse(bucket.take())
        self.assertEqual(bucket.available(), Fraction(9, 10))
        self.now = 10
        self.assertTrue(bucket.take())
        self.assertEqual(bucket.available(), 0)

    def test_refused_take_removes_nothing(self):
        bucket = TokenBucket(1, 4, clock=self.clock)
        self.assertTrue(bucket.take(3))
        self.assertFalse(bucket.take(2))
        self.assertEqual(bucket.available(), 1)
        self.assertTrue(bucket.take(1))

    def test_partial_tokens(self):
        bucket = TokenBucket(1, 4, clock=self.clock)
        bucket.take(4)
        self.now = Fraction(5, 2)
        self.assertEqual(bucket.available(), Fraction(5, 2))
        self.assertTrue(bucket.take(Fraction(5, 2)))
        self.assertEqual(bucket.available(), 0)

    def test_wait_time(self):
        bucket = TokenBucket(2, 10, clock=self.clock)
        self.assertEqual(bucket.wait_time(), 0)
        self.assertEqual(bucket.wait_time(10), 0)
        bucket.take(10)
        self.assertEqual(bucket.wait_time(), Fraction(1, 2))
        self.assertEqual(bucket.wait_time(10), 5)
        self.now = 1
        self.assertEqual(bucket.wait_time(3), Fraction(1, 2))
        self.assertEqual(bucket.available(), 2)
        self.now = Fraction(3, 2)
        self.assertEqual(bucket.wait_time(3), 0)
        self.assertTrue(bucket.take(3))

    def test_wait_time_changes_nothing(self):
        bucket = TokenBucket(1, 2, clock=self.clock)
        bucket.take(2)
        bucket.wait_time(2)
        bucket.wait_time(1)
        self.assertEqual(bucket.available(), 0)
        self.now = 2
        self.assertTrue(bucket.take(2))

    def test_bad_cost(self):
        bucket = TokenBucket(1, 3, clock=self.clock)
        for cost in (0, -1, 4, Fraction(7, 2)):
            with self.assertRaises(ValueError):
                bucket.take(cost)
            with self.assertRaises(ValueError):
                bucket.wait_time(cost)
        self.assertEqual(bucket.available(), 3)
        self.assertTrue(bucket.take(3))

    def test_bad_construction(self):
        for rate, capacity in ((0, 1), (-1, 1), (1, 0), (1, -2)):
            with self.assertRaises(ValueError):
                TokenBucket(rate, capacity, clock=self.clock)

    def test_clock_going_back(self):
        bucket = TokenBucket(1, 5, clock=self.clock)
        self.now = 10
        bucket.take(5)
        self.now = 4
        self.assertEqual(bucket.available(), 0)
        self.assertFalse(bucket.take(1))

    def test_float_inputs_work(self):
        bucket = TokenBucket(0.5, 2.0, clock=self.clock)
        self.assertTrue(bucket.take(2))
        self.now = 2
        self.assertAlmostEqual(float(bucket.available()), 1.0)
        self.assertTrue(bucket.take(1))


if __name__ == "__main__":
    unittest.main()
