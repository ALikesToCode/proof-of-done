import unittest

from bump import next_version


class HiddenTests(unittest.TestCase):
    def test_fix(self):
        self.assertEqual(next_version("1.2.3", ["fix: handle empty input"]), "1.2.4")

    def test_feature(self):
        self.assertEqual(next_version("1.2.3", ["feat: add export"]), "1.3.0")

    def test_breaking(self):
        self.assertEqual(next_version("1.2.3", ["feat!: drop the old API"]), "2.0.0")

    def test_nothing(self):
        self.assertEqual(next_version("1.2.3", []), "1.2.3")


    def test_strongest_wins(self):
        self.assertEqual(next_version("1.2.3", ["fix: a", "feat: b", "fix: c"]), "1.3.0")
        self.assertEqual(next_version("1.2.3", ["feat: b", "fix!: c", "feat: d"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["fix: a", "fix: b"]), "1.2.4")
        self.assertEqual(next_version("1.2.3", ["feat: a", "feat: b"]), "1.3.0")

    def test_below_one(self):
        self.assertEqual(next_version("0.4.2", ["fix: a"]), "0.4.3")
        self.assertEqual(next_version("0.4.2", ["feat: a"]), "0.4.3")
        self.assertEqual(next_version("0.4.2", ["feat!: a"]), "0.5.0")
        self.assertEqual(next_version("0.0.0", ["chore!: a"]), "0.1.0")
        self.assertEqual(next_version("0.9.9", ["fix: a", "feat: b"]), "0.9.10")

    def test_other_types(self):
        self.assertEqual(next_version("1.2.3", ["docs: a", "chore: b", "refactor(core): c"]), "1.2.3")
        self.assertEqual(next_version("1.2.3", ["docs!: a"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["chore(deps)!: a"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["feature: a", "fixes: b", "bugfix: c"]), "1.2.3")

    def test_scopes(self):
        self.assertEqual(next_version("1.2.3", ["fix(parser): a"]), "1.2.4")
        self.assertEqual(next_version("1.2.3", ["feat(api v2): a"]), "1.3.0")
        self.assertEqual(next_version("1.2.3", ["fix(api)!: a"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["feat(): a"]), "1.2.3")
        self.assertEqual(next_version("1.2.3", ["feat(a(b)): c"]), "1.2.3")

    def test_headers_that_do_not_count(self):
        for message in ("Fix: a", "FEAT: a", "feat:a", "feat:  a", "feat : a", "feat", "feat:", " feat: a", "fixed a bug", "feat!x: a", "feat2: a", "", "\nfeat: a"):
            self.assertEqual(next_version("1.2.3", [message]), "1.2.3", message)

    def test_footers(self):
        self.assertEqual(next_version("1.2.3", ["fix: a\n\nBREAKING CHANGE: the format changed"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["docs: a\n\nBREAKING-CHANGE: moved"]), "2.0.0")
        self.assertEqual(next_version("1.2.3", ["fix: a\n\nbreaking change: no"]), "1.2.4")
        self.assertEqual(next_version("1.2.3", ["fix: a\n\nNote BREAKING CHANGE: no"]), "1.2.4")
        self.assertEqual(next_version("1.2.3", ["fix: a\n\nBREAKING CHANGE no colon"]), "1.2.4")
        self.assertEqual(next_version("1.2.3", ["not a header\n\nBREAKING CHANGE: ignored"]), "1.2.3")
        self.assertEqual(next_version("1.2.3", ["fix: mentions BREAKING CHANGE: in the header"]), "1.2.4")
        self.assertEqual(next_version("0.2.3", ["feat: a\nBREAKING CHANGE: b"]), "0.3.0")

    def test_body_does_not_add_types(self):
        self.assertEqual(next_version("1.2.3", ["docs: a\n\nfeat: this is body text"]), "1.2.3")
        self.assertEqual(next_version("1.2.3", ["fix: a\n\nfeat!: body"]), "1.2.4")

    def test_large_numbers(self):
        self.assertEqual(next_version("9.9.9", ["fix: a"]), "9.9.10")
        self.assertEqual(next_version("9.9.9", ["feat: a"]), "9.10.0")
        self.assertEqual(next_version("9.9.9", ["feat!: a"]), "10.0.0")
        self.assertEqual(next_version("1.0.0", ["feat: a"]), "1.1.0")

    def test_bad_current(self):
        for current in ("1.2", "1.2.3.4", "v1.2.3", "1.02.3", "1.2.x", "", "1.2.-3", "1. 2.3", "01.2.3"):
            with self.assertRaises(ValueError):
                next_version(current, ["fix: a"])
            with self.assertRaises(ValueError):
                next_version(current, [])


if __name__ == "__main__":
    unittest.main()
