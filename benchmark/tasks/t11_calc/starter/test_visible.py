import unittest

from calc import evaluate


class VisibleTests(unittest.TestCase):
    def test_basic(self):
        self.assertEqual(evaluate("1 + 2 * 3"), 7)
        self.assertEqual(evaluate("(1 + 2) * 3"), 9)
        self.assertEqual(evaluate("10 - 4 - 3"), 3)

    def test_unary(self):
        self.assertEqual(evaluate("-5 + 2"), -3)

    def test_power(self):
        self.assertEqual(evaluate("2 ** 10"), 1024)

    def test_garbage(self):
        with self.assertRaises(ValueError):
            evaluate("2 +")


if __name__ == "__main__":
    unittest.main()
