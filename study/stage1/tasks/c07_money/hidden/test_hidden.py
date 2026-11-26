import unittest

from money import split_amount


class HiddenTests(unittest.TestCase):
    def test_even_split(self):
        self.assertEqual(split_amount(90, 3), [30, 30, 30])

    def test_one_part(self):
        self.assertEqual(split_amount(55, 1), [55])

    def test_remainder_goes_to_first(self):
        self.assertEqual(split_amount(100, 3), [34, 33, 33])

    def test_two_left_over(self):
        self.assertEqual(split_amount(101, 3), [34, 34, 33])
        self.assertEqual(split_amount(7, 5), [2, 2, 1, 1, 1])

    def test_shares_add_up(self):
        for cents, parts in ((100, 3), (1, 4), (999, 7), (0, 2), (12345, 11)):
            shares = split_amount(cents, parts)
            self.assertEqual(sum(shares), cents)
            self.assertEqual(len(shares), parts)

    def test_shares_differ_by_at_most_one(self):
        for cents, parts in ((100, 3), (999, 7), (12345, 11)):
            shares = split_amount(cents, parts)
            self.assertLessEqual(max(shares) - min(shares), 1)
            self.assertEqual(shares, sorted(shares, reverse=True))

    def test_shares_are_int(self):
        for share in split_amount(100, 3):
            self.assertIs(type(share), int)

    def test_amount_smaller_than_parts(self):
        self.assertEqual(split_amount(2, 4), [1, 1, 0, 0])
        self.assertEqual(split_amount(1, 3), [1, 0, 0])

    def test_zero_amount(self):
        self.assertEqual(split_amount(0, 2), [0, 0])

    def test_negative_amount_larger_shares_first(self):
        self.assertEqual(split_amount(-100, 3), [-34, -33, -33])
        self.assertEqual(split_amount(-101, 3), [-34, -34, -33])

    def test_negative_amount_smaller_than_parts(self):
        self.assertEqual(split_amount(-2, 4), [-1, -1, 0, 0])
        self.assertEqual(split_amount(-1, 3), [-1, 0, 0])

    def test_negative_even_split(self):
        self.assertEqual(split_amount(-90, 3), [-30, -30, -30])
        self.assertEqual(split_amount(-55, 1), [-55])

    def test_negative_shares_add_up(self):
        for cents, parts in ((-100, 3), (-1, 4), (-999, 7)):
            shares = split_amount(cents, parts)
            self.assertEqual(sum(shares), cents)
            self.assertEqual(len(shares), parts)

    def test_rejects_parts_below_one(self):
        for parts in (0, -2):
            with self.assertRaises(ValueError):
                split_amount(100, parts)

    def test_float_is_a_type_error(self):
        for cents, parts in ((100.0, 3), (100, 3.0), (99.5, 2)):
            with self.assertRaises(TypeError):
                split_amount(cents, parts)

    def test_str_is_a_type_error(self):
        for cents, parts in (("100", 3), (100, "3")):
            with self.assertRaises(TypeError):
                split_amount(cents, parts)


if __name__ == "__main__":
    unittest.main()
