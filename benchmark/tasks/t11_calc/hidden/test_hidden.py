import unittest

from calc import evaluate


class HiddenTests(unittest.TestCase):
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


    def bad(self, text):
        with self.assertRaises(ValueError):
            evaluate(text)

    def test_power_is_right_associative(self):
        self.assertEqual(evaluate("2 ** 3 ** 2"), 512)
        self.assertEqual(evaluate("(2 ** 3) ** 2"), 64)

    def test_unary_under_power(self):
        self.assertEqual(evaluate("-2 ** 2"), -4)
        self.assertEqual(evaluate("(-2) ** 2"), 4)
        self.assertEqual(evaluate("2 * -3"), -6)
        self.assertEqual(evaluate("--3"), 3)
        self.assertEqual(evaluate("+-+4"), -4)
        self.assertEqual(evaluate("2 - -2"), 4)
        self.assertEqual(evaluate("-2 ** 2 * 3"), -12)

    def test_negative_exponent(self):
        self.bad("2 ** -1")
        self.assertEqual(evaluate("2 ** -0"), 1)
        self.assertEqual(evaluate("0 ** 0"), 1)
        self.assertEqual(evaluate("2 ** --2"), 4)

    def test_floor_division_and_modulo(self):
        self.assertEqual(evaluate("-7 // 2"), -4)
        self.assertEqual(evaluate("-7 % 2"), 1)
        self.assertEqual(evaluate("7 // -2"), -4)
        self.assertEqual(evaluate("7 % 3 * 2"), 2)
        self.assertEqual(evaluate("100 // 7 // 2"), 7)

    def test_zero_divisor(self):
        for text in ("1 // 0", "1 % 0", "5 // (2 - 2)"):
            with self.assertRaises(ZeroDivisionError):
                evaluate(text)

    def test_result_is_int(self):
        self.assertIs(type(evaluate("7 // 2")), int)
        self.assertIs(type(evaluate("2 ** 2")), int)

    def test_numbers(self):
        self.assertEqual(evaluate("0"), 0)
        self.assertEqual(evaluate("120"), 120)
        self.bad("007")
        self.bad("1.5")
        self.bad("1 0")

    def test_spacing(self):
        self.assertEqual(evaluate(" 1+2\t*3 "), 7)
        self.assertEqual(evaluate("2**3"), 8)
        self.bad("2 * * 3")
        self.bad("7 / / 2")

    def test_malformed(self):
        for text in ("", "   ", "()", "(1 + 2", "1 + 2)", "1 +", "* 2", "4 / 2", "2 x 3", "1 + + ", "abc", "(", "1 2 +"):
            self.bad(text)

    def test_nested(self):
        self.assertEqual(evaluate("((2 + 3) * (4 - 1)) % 7"), 1)
        self.assertEqual(evaluate("-(2 + 3) ** 2"), -25)
        self.assertEqual(evaluate("2 ** (1 + 2) ** 2"), 512)


if __name__ == "__main__":
    unittest.main()
