import unittest

from cronfield import expand_field


class VisibleTests(unittest.TestCase):
    def test_star(self):
        self.assertEqual(expand_field("*", 1, 12), list(range(1, 13)))

    def test_single_number(self):
        self.assertEqual(expand_field("7", 0, 59), [7])

    def test_list(self):
        self.assertEqual(expand_field("5,1,5", 0, 59), [1, 5])

    def test_range(self):
        self.assertEqual(expand_field("10-13", 0, 59), [10, 11, 12, 13])

    def test_step(self):
        self.assertEqual(expand_field("*/15", 0, 59), [0, 15, 30, 45])
        self.assertEqual(expand_field("10-20/4", 0, 59), [10, 14, 18])

    def test_out_of_range(self):
        with self.assertRaises(ValueError):
            expand_field("60", 0, 59)

    def test_name(self):
        with self.assertRaises(ValueError):
            expand_field("MON", 0, 6)


if __name__ == "__main__":
    unittest.main()
