import unittest

import durations


class HiddenTests(unittest.TestCase):
    def bad(self, text):
        with self.assertRaises(ValueError):
            durations.parse_duration(text)

    def test_format_duration_unchanged(self):
        self.assertEqual(durations.format_duration(5400), "1h30m")
        self.assertEqual(durations.format_duration(0), "0s")

    def test_combined(self):
        self.assertEqual(durations.parse_duration("1h30m"), 5400)
        self.assertEqual(durations.parse_duration("1h1m1s"), 3661)

    def test_single_units(self):
        self.assertEqual(durations.parse_duration("45s"), 45)
        self.assertEqual(durations.parse_duration("2h"), 7200)
        self.assertEqual(durations.parse_duration("3m"), 180)

    def test_result_is_int(self):
        self.assertIs(type(durations.parse_duration("1h30m")), int)

    def test_number_larger_than_the_next_unit(self):
        self.assertEqual(durations.parse_duration("90m"), 5400)
        self.assertEqual(durations.parse_duration("100s"), 100)
        self.assertEqual(durations.parse_duration("1h90m"), 9000)

    def test_zeros(self):
        self.assertEqual(durations.parse_duration("05s"), 5)
        self.assertEqual(durations.parse_duration("0s"), 0)
        self.assertEqual(durations.parse_duration("0h0m0s"), 0)
        self.assertEqual(durations.parse_duration("001h"), 3600)

    def test_unit_left_out(self):
        self.assertEqual(durations.parse_duration("1h5s"), 3605)
        self.assertEqual(durations.parse_duration("2m3s"), 123)

    def test_upper_case_unit(self):
        self.bad("1H")
        self.bad("5S")
        self.bad("1h30M")

    def test_units_out_of_order(self):
        self.bad("30m1h")
        self.bad("5s1m")
        self.bad("1s1h")

    def test_repeated_unit(self):
        self.bad("1m2m")
        self.bad("1h2h")
        self.bad("1s1s")

    def test_outer_whitespace(self):
        self.assertEqual(durations.parse_duration(" 1h30m\n"), 5400)
        self.assertEqual(durations.parse_duration("\t45s  "), 45)

    def test_inner_whitespace(self):
        self.bad("1h 30m")
        self.bad("1 h")
        self.bad("1h30 m")

    def test_empty(self):
        self.bad("")
        self.bad("   ")
        self.bad("\n")

    def test_number_without_unit(self):
        self.bad("1h30")
        self.bad("90")

    def test_unit_without_number(self):
        self.bad("h")
        self.bad("1hm")

    def test_unknown_unit(self):
        self.bad("10x")
        self.bad("abc")
        self.bad("1d")

    def test_sign(self):
        self.bad("-5s")
        self.bad("+5s")
        self.bad("1h-30m")

    def test_fraction(self):
        self.bad("1.5h")
        self.bad("1h0.5m")

    def test_type_error(self):
        for value in (90, None, 1.5, b"1h"):
            with self.assertRaises(TypeError):
                durations.parse_duration(value)


if __name__ == "__main__":
    unittest.main()
