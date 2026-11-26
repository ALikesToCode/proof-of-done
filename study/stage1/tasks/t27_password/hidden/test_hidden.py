import unittest

from password import problems


class HiddenTests(unittest.TestCase):
    def test_good_password(self):
        self.assertEqual(problems("Tr1cky-Horse"), [])

    def test_existing_rules(self):
        self.assertEqual(problems("short"), ["too_short", "no_upper", "no_digit", "no_symbol"])

    def test_repeated(self):
        self.assertEqual(problems("Tr1cky-Hooorse"), ["repeated"])

    def test_contains_username(self):
        self.assertEqual(problems("Tr1cky-Horse", "horse"), ["contains_username"])


    def test_repeat_edges(self):
        self.assertEqual(problems("Tr1cky-Hoorse"), [])
        self.assertEqual(problems("Tr1cky-HoOorse"), [])
        self.assertEqual(problems("Tr1cky-Horse!!!"), ["repeated"])
        self.assertEqual(problems("aaaTr1cky-Horse"), ["repeated"])
        self.assertEqual(problems("Tr1cky-Horse111"), ["repeated"])
        self.assertEqual(problems("Tr1cky-Hoooorse-zzz"), ["repeated"])

    def test_username_edges(self):
        self.assertEqual(problems("Tr1cky-Horse", "HORSE"), ["contains_username"])
        self.assertEqual(problems("Tr1cky-Horse", "ho"), [])
        self.assertEqual(problems("Tr1cky-Horse", ""), [])
        self.assertEqual(problems("Tr1cky-Horse", "hor"), ["contains_username"])
        self.assertEqual(problems("Tr1cky-Horse", "pony"), [])
        self.assertEqual(problems("Tr1cky-Horse", "tr1cky-horse"), ["contains_username"])

    def test_order_with_everything(self):
        self.assertEqual(problems("aaa b"), ["too_short", "no_upper", "no_digit", "no_symbol", "has_whitespace", "repeated"])
        self.assertEqual(problems("AAA bob", "Bob"), ["too_short", "no_digit", "no_symbol", "has_whitespace", "repeated", "contains_username"])
        self.assertEqual(problems("", "bob"), ["too_short", "no_lower", "no_upper", "no_digit", "no_symbol"])

    def test_existing_rules_stay(self):
        self.assertEqual(problems("Tr1cky-Hors"), [])
        self.assertEqual(problems("Tr1cky-Hor"), [])
        self.assertEqual(problems("Tr1cky-Ho"), ["too_short"])
        self.assertEqual(problems("tr1cky-horse"), ["no_upper"])
        self.assertEqual(problems("TR1CKY-HORSE"), ["no_lower"])
        self.assertEqual(problems("Tricky-Horse"), ["no_digit"])
        self.assertEqual(problems("Tr1ckyXHorse"), ["no_symbol"])
        self.assertEqual(problems("Tr1cky Horse"), ["no_symbol", "has_whitespace"])
        self.assertEqual(problems("Tr1cky-\tHorse"), ["has_whitespace"])
        self.assertEqual(problems("Tr1cky_Horse"), [])

    def test_whitespace_runs(self):
        self.assertEqual(problems("Tr1cky-   Horse"), ["has_whitespace", "repeated"])

    def test_names_appear_once(self):
        result = problems("aaaa bbbb    cccc")
        self.assertEqual(len(result), len(set(result)))
        self.assertEqual(result, ["no_upper", "no_digit", "no_symbol", "has_whitespace", "repeated"])


if __name__ == "__main__":
    unittest.main()
