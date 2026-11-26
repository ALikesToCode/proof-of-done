import unittest

from normpath import join, normalize


class HiddenTests(unittest.TestCase):
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


    def test_root(self):
        self.assertEqual(normalize("/"), "/")
        self.assertEqual(normalize("//"), "/")
        self.assertEqual(normalize("///a"), "/a")
        self.assertEqual(normalize("/."), "/")
        self.assertEqual(normalize("/a/.."), "/")
        self.assertEqual(normalize("/./"), "/")

    def test_parent_at_root(self):
        self.assertEqual(normalize("/../a"), "/a")
        self.assertEqual(normalize("/.."), "/")
        self.assertEqual(normalize("/a/../../b"), "/b")
        self.assertEqual(normalize("/../../.."), "/")

    def test_relative_parents_are_kept(self):
        self.assertEqual(normalize("a/../../b"), "../b")
        self.assertEqual(normalize(".."), "..")
        self.assertEqual(normalize("../.."), "../..")
        self.assertEqual(normalize("../a/.."), "..")
        self.assertEqual(normalize("../a/../.."), "../..")
        self.assertEqual(normalize("./../a"), "../a")
        self.assertEqual(normalize("a/b/../../../c/"), "../c")

    def test_empty_result(self):
        self.assertEqual(normalize(""), ".")
        self.assertEqual(normalize("."), ".")
        self.assertEqual(normalize("./"), ".")
        self.assertEqual(normalize("a/.."), ".")
        self.assertEqual(normalize("a/b/../.."), ".")
        self.assertEqual(normalize("./."), ".")

    def test_ordinary_names(self):
        self.assertEqual(normalize("a/.../b"), "a/.../b")
        self.assertEqual(normalize("a..b/..c/d.."), "a..b/..c/d..")
        self.assertEqual(normalize("a/ /b"), "a/ /b")
        self.assertEqual(normalize("/.hidden/..x"), "/.hidden/..x")
        self.assertEqual(normalize("a/.../.."), "a")

    def test_trailing_and_runs(self):
        self.assertEqual(normalize("a/"), "a")
        self.assertEqual(normalize("a///"), "a")
        self.assertEqual(normalize("a//b////c"), "a/b/c")
        self.assertEqual(normalize("../"), "..")

    def test_join_absolute_part_replaces(self):
        self.assertEqual(join("a", "/x", "y"), "/x/y")
        self.assertEqual(join("/a/b", "/"), "/")
        self.assertEqual(join("/a", "b", "/c", "../d"), "/d")
        self.assertEqual(join("a", "//x"), "/x")

    def test_join_relative(self):
        self.assertEqual(join("a", "b"), "a/b")
        self.assertEqual(join("a", "../.."), "..")
        self.assertEqual(join("", "a"), "a")
        self.assertEqual(join("a/", "b/"), "a/b")
        self.assertEqual(join(".", "a"), "a")
        self.assertEqual(join("..", "a", ".."), "..")
        self.assertEqual(join("/", "..", "a"), "/a")

    def test_join_edges(self):
        self.assertEqual(join("/a//b/"), "/a/b")
        self.assertEqual(join(""), ".")
        self.assertEqual(join("a", ""), "a")
        self.assertEqual(join("/a", "", "b", ""), "/a/b")
        self.assertEqual(join("a", "..", ""), ".")


if __name__ == "__main__":
    unittest.main()
