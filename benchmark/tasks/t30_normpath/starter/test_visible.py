import unittest

from normpath import join, normalize


class VisibleTests(unittest.TestCase):
    def test_clean(self):
        self.assertEqual(normalize("/a/b"), "/a/b")
        self.assertEqual(normalize("a//b/./c"), "a/b/c")

    def test_parent(self):
        self.assertEqual(normalize("/a/b/../c"), "/a/c")

    def test_trailing_slash(self):
        self.assertEqual(normalize("/a/b/"), "/a/b")

    def test_join(self):
        self.assertEqual(join("/a", "b", "c"), "/a/b/c")
        self.assertEqual(join("/a/b", "../c"), "/a/c")


if __name__ == "__main__":
    unittest.main()
