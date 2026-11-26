import unittest

from ledger import line_total, order_total, split_evenly


class VisibleTests(unittest.TestCase):
    def test_reported_line(self):
        self.assertEqual(line_total(485, 1, 50), 243)

    def test_line_without_discount(self):
        self.assertEqual(line_total(250, 4), 1000)

    def test_order_total(self):
        self.assertEqual(order_total([(1000, 2, 0), (500, 1, 10)], tax_rate_percent=10, shipping_cents=300), 2995)

    def test_split(self):
        self.assertEqual(split_evenly(100, 3), [34, 33, 33])


if __name__ == "__main__":
    unittest.main()
