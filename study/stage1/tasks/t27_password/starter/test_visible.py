import unittest

from password import problems


class VisibleTests(unittest.TestCase):
    def test_good_password(self):
        self.assertEqual(problems("Tr1cky-Horse"), [])

    def test_existing_rules(self):
        self.assertEqual(problems("short"), ["too_short", "no_upper", "no_digit", "no_symbol"])

    def test_repeated(self):
        self.assertEqual(problems("Tr1cky-Hooorse"), ["repeated"])

    def test_contains_username(self):
        self.assertEqual(problems("Tr1cky-Horse", "horse"), ["contains_username"])


if __name__ == "__main__":
    unittest.main()
