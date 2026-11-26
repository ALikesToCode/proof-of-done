import unittest

from duration import parse_duration


class HiddenTests(unittest.TestCase):
    def bad(self, text):
        with self.assertRaises(ValueError):
            parse_duration(text)

    def test_visible_cases(self):
        self.assertEqual(parse_duration("90s"), 90000)
        self.assertEqual(parse_duration("1h30m"), 5400000)
        self.assertEqual(parse_duration("1h 30m"), 5400000)
        self.assertEqual(parse_duration("1.5h"), 5400000)
        self.bad("abc")

    def test_all_units(self):
        self.assertEqual(parse_duration("1w"), 604800000)
        self.assertEqual(parse_duration("1d"), 86400000)
        self.assertEqual(parse_duration("1w2d3h4m5s6ms"), 604800000 + 2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5000 + 6)
        self.assertEqual(parse_duration("5ms"), 5)
        self.assertEqual(parse_duration("2m 5ms"), 120005)

    def test_result_is_int(self):
        self.assertIs(type(parse_duration("1.5s")), int)

    def test_upper_case_unit(self):
        self.bad("1H")
        self.bad("5MS")

    def test_order(self):
        self.bad("30m1h")
        self.bad("5ms1s")
        self.bad("1s1m")

    def test_repeated_unit(self):
        self.bad("1h2h")
        self.bad("1s 2s")

    def test_spacing(self):
        self.assertEqual(parse_duration("  1h 30m \n"), 5400000)
        self.bad("1h  30m")
        self.bad("1 h")
        self.bad("1h\t30m")

    def test_fraction_only_on_last(self):
        self.assertEqual(parse_duration("1h30.5m"), 3600000 + 1830000)
        self.bad("1.5h30m")

    def test_fraction_shape(self):
        self.bad(".5h")
        self.bad("5.h")
        self.bad("1.2.3s")

    def test_half_rounds_away_from_zero(self):
        self.assertEqual(parse_duration("2.5ms"), 3)
        self.assertEqual(parse_duration("0.5ms"), 1)
        self.assertEqual(parse_duration("0.0005s"), 1)
        self.assertEqual(parse_duration("1.4ms"), 1)
        self.assertEqual(parse_duration("1s 0.5ms"), 1001)

    def test_exact_arithmetic(self):
        self.assertEqual(parse_duration("1.1s"), 1100)
        self.assertEqual(parse_duration("0.0045s"), 5)
        self.assertEqual(parse_duration("1.0005s"), 1001)

    def test_negative(self):
        self.assertEqual(parse_duration("-1h30m"), -5400000)
        self.assertEqual(parse_duration("-2.5ms"), -3)
        self.assertEqual(parse_duration("-0s"), 0)
        self.assertEqual(parse_duration(" -5s"), -5000)

    def test_bad_signs(self):
        self.bad("+1h")
        self.bad("--1h")
        self.bad("1h-30m")
        self.bad("-")

    def test_empty_and_bare(self):
        self.bad("")
        self.bad("   ")
        self.bad("90")
        self.bad("1h30")
        self.bad("h")

    def test_unknown_unit(self):
        self.bad("5y")
        self.bad("5sec")

    def test_type_error(self):
        for value in (90, None, 1.5, b"1h"):
            with self.assertRaises(TypeError):
                parse_duration(value)


if __name__ == "__main__":
    unittest.main()
