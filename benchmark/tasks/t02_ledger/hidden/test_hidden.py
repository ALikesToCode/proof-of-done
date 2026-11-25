import unittest
from decimal import Decimal

from ledger import line_total, order_total, split_evenly, tax


class HiddenTests(unittest.TestCase):
    def test_visible_cases(self):
        self.assertEqual(line_total(485, 1, 50), 243)
        self.assertEqual(line_total(250, 4), 1000)
        self.assertEqual(order_total([(1000, 2, 0), (500, 1, 10)], tax_rate_percent=10, shipping_cents=300), 2995)
        self.assertEqual(split_evenly(100, 3), [34, 33, 33])

    def test_line_half_up(self):
        self.assertEqual(line_total(1005, 1, 50), 503)
        self.assertEqual(line_total(5, 1, 50), 3)
        self.assertEqual(line_total(1, 1, 50), 1)

    def test_line_exact_decimal(self):
        self.assertEqual(line_total(35, 1, 30), 25)
        self.assertEqual(line_total(5, 7, 30), 25)

    def test_line_rounds_down_below_half(self):
        self.assertEqual(line_total(333, 1, 50), 167)
        self.assertEqual(line_total(999, 1, 33), 669)
        self.assertEqual(line_total(100, 1, 0.6), 99)

    def test_tax_half_up(self):
        self.assertEqual(tax(450, 5), 23)
        self.assertEqual(tax(250, 5), 13)
        self.assertEqual(tax(50, 1), 1)

    def test_tax_exact_decimal(self):
        self.assertEqual(tax(1000, 8.25), 83)
        self.assertEqual(tax(200, 8.25), 17)
        self.assertEqual(tax(35, 70), 25)

    def test_tax_plain(self):
        self.assertEqual(tax(1000, 20), 200)
        self.assertEqual(tax(0, 20), 0)
        self.assertEqual(tax(999, 0), 0)

    def test_decimal_percentages(self):
        self.assertEqual(tax(450, Decimal("5")), 23)
        self.assertEqual(line_total(35, 1, Decimal("30")), 25)
        self.assertEqual(tax(200, Decimal("8.25")), 17)

    def test_results_are_int(self):
        self.assertIs(type(line_total(485, 1, 50)), int)
        self.assertIs(type(tax(450, 5)), int)
        self.assertIs(type(order_total([(485, 1, 50)], 5, 10)), int)

    def test_order_total_uses_fixed_rounding(self):
        # line: 242.5 -> 243; tax 5% of 243 = 12.15 -> 12
        self.assertEqual(order_total([(485, 1, 50)], tax_rate_percent=5), 255)
        # lines: 25 + 25 = 50; tax 5% of 50 = 2.5 -> 3; shipping 7
        self.assertEqual(order_total([(35, 1, 30), (5, 7, 30)], tax_rate_percent=5, shipping_cents=7), 60)

    def test_order_total_defaults(self):
        self.assertEqual(order_total([]), 0)
        self.assertEqual(order_total([(100, 1, 0)]), 100)

    def test_split_sums_and_order(self):
        self.assertEqual(split_evenly(101, 3), [34, 34, 33])
        self.assertEqual(split_evenly(7, 7), [1] * 7)
        self.assertEqual(split_evenly(2, 5), [1, 1, 0, 0, 0])
        self.assertEqual(split_evenly(0, 2), [0, 0])
        self.assertEqual(split_evenly(99, 1), [99])
        for total, parts in ((1000, 7), (12345, 11), (5, 6)):
            shares = split_evenly(total, parts)
            self.assertEqual(sum(shares), total)
            self.assertEqual(len(shares), parts)
            self.assertLessEqual(max(shares) - min(shares), 1)
            self.assertEqual(shares, sorted(shares, reverse=True))

    def test_split_bad_parts(self):
        for parts in (0, -1):
            with self.assertRaises(ValueError):
                split_evenly(100, parts)


if __name__ == "__main__":
    unittest.main()
