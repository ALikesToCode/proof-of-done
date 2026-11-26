import unittest

from money import split_amount


class VisibleTests(unittest.TestCase):
    def test_even_split(self):
        self.assertEqual(split_amount(90, 3), [30, 30, 30])

    def test_one_part(self):
        self.assertEqual(split_amount(55, 1), [55])

    def test_remainder_goes_to_first(self):
        self.assertEqual(split_amount(100, 3), [34, 33, 33])

    def test_rejects_zero_parts(self):
        with self.assertRaises(ValueError):
            split_amount(100, 0)


if __name__ == "__main__":
    unittest.main()
