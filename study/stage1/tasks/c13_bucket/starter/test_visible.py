import unittest

from bucket import TokenBucket


class VisibleTests(unittest.TestCase):
    def test_allows_up_to_capacity(self):
        bucket = TokenBucket(2, 1)
        self.assertIs(bucket.allow(0), True)
        self.assertIs(bucket.allow(0), True)

    def test_blocks_when_empty(self):
        bucket = TokenBucket(1, 1)
        bucket.allow(0)
        self.assertIs(bucket.allow(0), False)

    def test_refills_after_a_second(self):
        bucket = TokenBucket(2, 1)
        self.assertIs(bucket.allow(0), True)
        self.assertIs(bucket.allow(0), True)
        self.assertIs(bucket.allow(0), False)
        self.assertIs(bucket.allow(1), True)

    def test_faster_rate(self):
        bucket = TokenBucket(4, 2)
        for _ in range(4):
            self.assertIs(bucket.allow(0), True)
        self.assertIs(bucket.allow(0), False)
        self.assertIs(bucket.allow(1), True)
        self.assertIs(bucket.allow(1), True)
        self.assertIs(bucket.allow(1), False)


if __name__ == "__main__":
    unittest.main()
