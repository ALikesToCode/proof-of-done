import unittest

from pointer import resolve

DOCUMENT = {"name": "kit", "tags": ["a", "b", "c"], "size": {"w": 3, "h": 4}, "x/y": 1, "m~n": 2}


class VisibleTests(unittest.TestCase):
    def test_whole_document(self):
        self.assertEqual(resolve(DOCUMENT, ""), DOCUMENT)

    def test_key(self):
        self.assertEqual(resolve(DOCUMENT, "/name"), "kit")

    def test_nested_key(self):
        self.assertEqual(resolve(DOCUMENT, "/size/h"), 4)

    def test_list_index(self):
        self.assertEqual(resolve(DOCUMENT, "/tags/1"), "b")

    def test_escapes(self):
        self.assertEqual(resolve(DOCUMENT, "/x~1y"), 1)
        self.assertEqual(resolve(DOCUMENT, "/m~0n"), 2)

    def test_missing_key(self):
        with self.assertRaises(KeyError):
            resolve(DOCUMENT, "/nope")

    def test_no_leading_slash(self):
        with self.assertRaises(ValueError):
            resolve(DOCUMENT, "name")


if __name__ == "__main__":
    unittest.main()
