import unittest

from backoff import schedule


class VisibleTests(unittest.TestCase):
    def test_doubling(self):
        self.assertEqual(schedule(4, 100), [100, 200, 400])

    def test_one_attempt(self):
        self.assertEqual(schedule(1, 100), [])

    def test_factor(self):
        self.assertEqual(schedule(4, 100, factor=3), [100, 300, 900])

    def test_cap(self):
        self.assertEqual(schedule(5, 100, cap=350), [100, 200, 350, 350])

    def test_budget(self):
        self.assertEqual(schedule(10, 100, budget=700), [100, 200, 400])

    def test_bad_attempts(self):
        with self.assertRaises(ValueError):
            schedule(0, 100)


if __name__ == "__main__":
    unittest.main()
