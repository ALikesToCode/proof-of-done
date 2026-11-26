import unittest

from glob_match import matches


class HiddenTests(unittest.TestCase):
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


    def test_star_stops_at_slash(self):
        self.assertFalse(matches("*.py", "src/a.py"))
        self.assertFalse(matches("a*", "a/b"))
        self.assertTrue(matches("*/*.py", "src/a.py"))
        self.assertFalse(matches("*/*.py", "src/x/a.py"))
        self.assertTrue(matches("a*", "a"))
        self.assertTrue(matches("*", ""))
        self.assertFalse(matches("?", "/"))

    def test_double_star_segments(self):
        self.assertTrue(matches("a/**/b", "a/b"))
        self.assertTrue(matches("a/**/b", "a/x/b"))
        self.assertTrue(matches("a/**/b", "a/x/y/b"))
        self.assertFalse(matches("a/**/b", "a/xb"))
        self.assertFalse(matches("a/**/b", "ab"))
        self.assertTrue(matches("**/x", "x"))
        self.assertTrue(matches("**/x", "a/b/x"))
        self.assertFalse(matches("**/x", "a/bx"))
        self.assertTrue(matches("a/**", "a/b/c"))
        self.assertTrue(matches("a/**", "a"))
        self.assertFalse(matches("a/**", "ab"))

    def test_double_star_alone(self):
        self.assertTrue(matches("**", ""))
        self.assertTrue(matches("**", "a"))
        self.assertTrue(matches("**", "a/b/c"))
        self.assertTrue(matches("**/**", "a/b"))

    def test_double_star_inside_a_segment(self):
        self.assertTrue(matches("a**b", "axxb"))
        self.assertTrue(matches("a**b", "ab"))
        self.assertFalse(matches("a**b", "a/b"))
        self.assertFalse(matches("**.py", "src/a.py"))
        self.assertTrue(matches("**.py", "a.py"))

    def test_classes(self):
        self.assertTrue(matches("[abc]x", "bx"))
        self.assertFalse(matches("[abc]x", "dx"))
        self.assertTrue(matches("[a-c]x", "cx"))
        self.assertFalse(matches("[a-c]x", "Cx"))
        self.assertTrue(matches("[!abc]x", "dx"))
        self.assertFalse(matches("[!abc]x", "ax"))
        self.assertFalse(matches("a[!x]b", "a/b"))
        self.assertTrue(matches("[]x]", "]"))
        self.assertTrue(matches("[]x]", "x"))
        self.assertTrue(matches("[!]x]", "y"))
        self.assertFalse(matches("[!]x]", "]"))
        self.assertTrue(matches("[*?]", "*"))
        self.assertFalse(matches("[*?]", "a"))
        self.assertTrue(matches("[a\\]", "\\"))
        self.assertTrue(matches("[0-9][0-9]", "42"))

    def test_escapes(self):
        self.assertTrue(matches("\\*", "*"))
        self.assertFalse(matches("\\*", "a"))
        self.assertTrue(matches("a\\?", "a?"))
        self.assertTrue(matches("\\\\", "\\"))
        self.assertTrue(matches("\\[a]", "[a]"))
        self.assertTrue(matches("\\a", "a"))

    def test_malformed(self):
        for pattern in ("[abc", "a[", "abc\\", "[c-a]", "[!", "[]"):
            with self.assertRaises(ValueError):
                matches(pattern, "a")

    def test_empty_and_case(self):
        self.assertTrue(matches("", ""))
        self.assertFalse(matches("", "a"))
        self.assertFalse(matches("a", ""))
        self.assertFalse(matches("A.txt", "a.txt"))
        self.assertFalse(matches("a/b", "a/b/"))
        self.assertFalse(matches("a", "a/"))

    def test_backtracking(self):
        self.assertTrue(matches("*a*b*c", "xxaxxbxxc"))
        self.assertFalse(matches("*a*b*c", "xxaxxcxxb"))
        self.assertTrue(matches("**/a/**/b", "x/a/y/a/z/b"))
        self.assertTrue(matches("a/**/**/b", "a/b"))


if __name__ == "__main__":
    unittest.main()
