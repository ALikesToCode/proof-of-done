import unittest

from bump import next_version


class VisibleTests(unittest.TestCase):
    def test_fix(self):
        self.assertEqual(next_version("1.2.3", ["fix: handle empty input"]), "1.2.4")

    def test_feature(self):
        self.assertEqual(next_version("1.2.3", ["feat: add export"]), "1.3.0")

    def test_breaking(self):
        self.assertEqual(next_version("1.2.3", ["feat!: drop the old API"]), "2.0.0")

    def test_nothing(self):
        self.assertEqual(next_version("1.2.3", []), "1.2.3")


if __name__ == "__main__":
    unittest.main()
