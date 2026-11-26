import unittest

from bucket import TokenBucket


class HiddenTests(unittest.TestCase):
    def calls(self, bucket, *steps):
        for now, expected in steps:
            self.assertIs(bucket.allow(now), expected, f"allow({now})")

    def test_starts_full(self):
        self.calls(TokenBucket(3, 1), (0, True), (0, True), (0, True), (0, False))

    def test_first_call_at_a_late_time(self):
        self.calls(TokenBucket(2, 1), (50, True), (50, True), (50, False))

    def test_refills_after_a_second(self):
        self.calls(TokenBucket(2, 1), (0, True), (0, True), (0, False), (1, True), (1, False))

    def test_refused_calls_remove_nothing(self):
        self.calls(TokenBucket(1, 1), (0, True), (0, False), (0, False), (1, True))

    def test_time_counts_from_a_refused_call(self):
        self.calls(TokenBucket(1, 1), (0, True), (0.5, False), (0.75, False), (1.25, True))

    def test_faster_rate(self):
        self.calls(TokenBucket(4, 2), (0, True), (0, True), (0, True), (0, True), (0, False), (1, True), (1, True), (1, False))

    def test_slower_rate(self):
        self.calls(TokenBucket(1, 0.5), (0, True), (1, False), (2, True), (2, False))

    def test_part_of_a_second(self):
        self.calls(TokenBucket(1, 1), (0, True), (0.5, False), (1.0, True))

    def test_part_tokens_add_up(self):
        self.calls(TokenBucket(1, 1), (0, True), (0.25, False), (0.5, False), (0.75, False), (1, True), (1.5, False))

    def test_refill_is_capped(self):
        self.calls(TokenBucket(2, 1), (0, True), (0, True), (100, True), (100, True), (100, False))

    def test_time_spent_full_is_not_saved(self):
        self.calls(TokenBucket(1, 1), (0, True), (60, True), (60, False), (60.5, False), (61, True))

    def test_earlier_time_adds_nothing(self):
        self.calls(TokenBucket(1, 1), (10, True), (0, False), (5, False))

    def test_seconds_are_not_paid_twice(self):
        self.calls(TokenBucket(1, 1), (10, True), (5, False), (10, False), (11, True))

    def test_latest_time_is_kept(self):
        self.calls(TokenBucket(3, 1), (20, True), (20, True), (20, True), (20, False), (0, False), (20, False), (21, True), (21, False))

    def test_earlier_time_then_part_of_a_second(self):
        self.calls(TokenBucket(1, 1), (4, True), (3.5, False), (4.5, False), (5, True))

    def test_rejects_bad_capacity(self):
        for capacity in (0, -1):
            with self.assertRaises(ValueError):
                TokenBucket(capacity, 1)

    def test_rejects_bad_rate(self):
        for per_second in (0, -2, -0.5):
            with self.assertRaises(ValueError):
                TokenBucket(2, per_second)


if __name__ == "__main__":
    unittest.main()
