import unittest

from glob_match import matches


class VisibleTests(unittest.TestCase):
    def test_literal(self):
        self.assertTrue(matches("a/b.txt", "a/b.txt"))
        self.assertFalse(matches("a/b.txt", "a/c.txt"))

    def test_star(self):
        self.assertTrue(matches("*.py", "main.py"))
        self.assertFalse(matches("*.py", "main.pyc"))

    def test_question(self):
        self.assertTrue(matches("a?c", "abc"))
        self.assertFalse(matches("a?c", "ac"))

    def test_double_star(self):
        self.assertTrue(matches("src/**/test.py", "src/a/b/test.py"))


if __name__ == "__main__":
    unittest.main()
