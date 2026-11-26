import unittest

from fractions import Fraction

from bucket import TokenBucket


class VisibleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
