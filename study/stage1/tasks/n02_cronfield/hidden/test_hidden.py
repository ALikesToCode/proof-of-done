import unittest

from cronfield import expand_field


class HiddenTests(unittest.TestCase):
    def bad(self, field, low=0, high=59):
        with self.assertRaises(ValueError):
            expand_field(field, low, high)

    def test_star(self):
        self.assertEqual(expand_field("*", 0, 59), list(range(60)))
        self.assertEqual(expand_field("*", 1, 12), list(range(1, 13)))
        self.assertEqual(expand_field("*", 3, 3), [3])

    def test_single_number(self):
        self.assertEqual(expand_field("7", 0, 59), [7])
        self.assertEqual(expand_field("0", 0, 59), [0])
        self.assertEqual(expand_field("59", 0, 59), [59])
        self.assertEqual(expand_field("12", 1, 12), [12])

    def test_list_is_sorted_without_duplicates(self):
        self.assertEqual(expand_field("5,1,5", 0, 59), [1, 5])
        self.assertEqual(expand_field("30,10,20", 0, 59), [10, 20, 30])
        self.assertEqual(expand_field("1-5,3-8", 0, 59), [1, 2, 3, 4, 5, 6, 7, 8])
        self.assertEqual(expand_field("*,5", 1, 7), [1, 2, 3, 4, 5, 6, 7])
        self.assertEqual(expand_field("40-42,*/20,7", 0, 59), [0, 7, 20, 40, 41, 42])

    def test_result_is_a_list_of_int(self):
        result = expand_field("1-3,*/30", 0, 59)
        self.assertIs(type(result), list)
        for value in result:
            self.assertIs(type(value), int)

    def test_range(self):
        self.assertEqual(expand_field("10-13", 0, 59), [10, 11, 12, 13])
        self.assertEqual(expand_field("0-59", 0, 59), list(range(60)))
        self.assertEqual(expand_field("4-4", 0, 59), [4])
        self.assertEqual(expand_field("1-12", 1, 12), list(range(1, 13)))

    def test_reversed_range(self):
        self.bad("5-3")
        self.bad("59-0")
        self.bad("10-9/2")
        self.bad("1,5-3")

    def test_step_on_star(self):
        self.assertEqual(expand_field("*/15", 0, 59), [0, 15, 30, 45])
        self.assertEqual(expand_field("*/5", 1, 12), [1, 6, 11])
        self.assertEqual(expand_field("*/1", 0, 6), [0, 1, 2, 3, 4, 5, 6])
        self.assertEqual(expand_field("*/59", 0, 59), [0, 59])

    def test_step_on_range(self):
        self.assertEqual(expand_field("10-20/4", 0, 59), [10, 14, 18])
        self.assertEqual(expand_field("10-20/5", 0, 59), [10, 15, 20])
        self.assertEqual(expand_field("4-4/3", 0, 59), [4])
        self.assertEqual(expand_field("1-12/1", 1, 12), list(range(1, 13)))

    def test_step_larger_than_high(self):
        self.assertEqual(expand_field("*/100", 0, 59), [0])
        self.assertEqual(expand_field("5-10/60", 0, 59), [5])
        self.assertEqual(expand_field("*/13", 1, 12), [1])

    def test_step_below_one(self):
        self.bad("*/0")
        self.bad("1-5/0")
        self.bad("3/0")
        self.bad("*/00")

    def test_number_with_step(self):
        self.assertEqual(expand_field("50/4", 0, 59), [50, 54, 58])
        self.assertEqual(expand_field("0/20", 0, 59), [0, 20, 40])
        self.assertEqual(expand_field("59/5", 0, 59), [59])
        self.assertEqual(expand_field("10/1", 1, 12), [10, 11, 12])

    def test_out_of_range(self):
        for field in ("0", "13", "10-13", "0-5", "13/2", "0/3", "1,13", "0-13"):
            self.bad(field, 1, 12)
        for field in ("60", "0-60", "58-60/1", "60/5", "1,60"):
            self.bad(field)

    def test_leading_zeros(self):
        self.assertEqual(expand_field("05", 0, 59), [5])
        self.assertEqual(expand_field("00-03", 0, 59), [0, 1, 2, 3])
        self.assertEqual(expand_field("*/015", 0, 59), [0, 15, 30, 45])
        self.assertEqual(expand_field("007,08", 0, 59), [7, 8])

    def test_sign(self):
        self.bad("+5")
        self.bad("1-+3")
        self.bad("*/+5")
        self.bad("5,+6")

    def test_space(self):
        self.bad(" 5")
        self.bad("5 ")
        self.bad("1, 2")
        self.bad("1 -3")
        self.bad("*/ 5")
        self.bad("* ")

    def test_underscore(self):
        self.bad("1_0")
        self.bad("1-1_0")
        self.bad("*/1_0")

    def test_empty_field_and_empty_part(self):
        self.bad("")
        self.bad(",")
        self.bad("1,,2")
        self.bad("1,")
        self.bad(",1")

    def test_missing_number(self):
        for field in ("-5", "3-", "*/", "/5", "-", "/", "5/", "1-/2"):
            self.bad(field)

    def test_other_shapes(self):
        for field in ("MON", "mon-fri", "1-2-3", "1/2/3", "*-5", "**", "*5", "1.5", "a", "5-*"):
            self.bad(field)


if __name__ == "__main__":
    unittest.main()
