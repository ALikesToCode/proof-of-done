import unittest

from pointer import resolve

DOCUMENT = {
    "a": {"b": [10, 20, {"c": None}]},
    "": 1,
    "x/y": 2,
    "m~n": 3,
    "~1": 4,
    "/": 5,
    "0": "zero",
    "s": "xyz",
    "n": 7,
    "f": 1.5,
    "t": True,
    "z": None,
    "e": {"": {"": "deep"}},
    "rows": [[1, 2], [3, 4]],
}


class HiddenTests(unittest.TestCase):
    def test_whole_document(self):
        self.assertIs(resolve(DOCUMENT, ""), DOCUMENT)
        self.assertEqual(resolve(5, ""), 5)
        self.assertEqual(resolve("text", ""), "text")
        self.assertEqual(resolve([], ""), [])
        self.assertIsNone(resolve(None, ""))

    def test_must_start_with_slash(self):
        for pointer in ("a", "a/b", " /a", "#/a", "0", "~0", " "):
            with self.assertRaises(ValueError):
                resolve(DOCUMENT, pointer)

    def test_tokens_left_to_right(self):
        self.assertEqual(resolve(DOCUMENT, "/a"), {"b": [10, 20, {"c": None}]})
        self.assertEqual(resolve(DOCUMENT, "/a/b"), [10, 20, {"c": None}])
        self.assertEqual(resolve(DOCUMENT, "/a/b/1"), 20)
        self.assertIsNone(resolve(DOCUMENT, "/a/b/2/c"))
        self.assertEqual(resolve(DOCUMENT, "/rows/1/0"), 3)
        self.assertEqual(resolve([{"k": [7]}], "/0/k/0"), 7)

    def test_scalar_at_the_end(self):
        self.assertEqual(resolve(DOCUMENT, "/s"), "xyz")
        self.assertEqual(resolve(DOCUMENT, "/n"), 7)
        self.assertIs(resolve(DOCUMENT, "/t"), True)
        self.assertIsNone(resolve(DOCUMENT, "/z"))

    def test_empty_tokens(self):
        self.assertEqual(resolve(DOCUMENT, "/"), 1)
        self.assertEqual(resolve(DOCUMENT, "/e/"), {"": "deep"})
        self.assertEqual(resolve(DOCUMENT, "/e//"), "deep")
        self.assertEqual(resolve({"a": {"": {"b": 9}}}, "/a//b"), 9)

    def test_escapes(self):
        self.assertEqual(resolve(DOCUMENT, "/x~1y"), 2)
        self.assertEqual(resolve(DOCUMENT, "/m~0n"), 3)
        self.assertEqual(resolve(DOCUMENT, "/~1"), 5)
        self.assertEqual(resolve({"~": 1, "//": 2, "~/": 3}, "/~0"), 1)
        self.assertEqual(resolve({"~": 1, "//": 2, "~/": 3}, "/~1~1"), 2)
        self.assertEqual(resolve({"~": 1, "//": 2, "~/": 3}, "/~0~1"), 3)

    def test_tilde_zero_one(self):
        self.assertEqual(resolve(DOCUMENT, "/~01"), 4)
        self.assertEqual(resolve({"a~1b": "tilde", "a/b": "slash"}, "/a~01b"), "tilde")

    def test_decoding_is_one_pass(self):
        document = {"~0": "a", "~11": "b", "/1": "c", "~1~0": "d", "/~": "e"}
        self.assertEqual(resolve(document, "/~00"), "a")
        self.assertEqual(resolve(document, "/~011"), "b")
        self.assertEqual(resolve(document, "/~11"), "c")
        self.assertEqual(resolve(document, "/~01~00"), "d")
        self.assertEqual(resolve(document, "/~1~0"), "e")

    def test_bad_escape(self):
        for pointer in ("/~", "/a~", "/~2", "/a~bc", "/~ ", "/a/~", "/a/b~", "/a/~x", "/~~"):
            with self.assertRaises(ValueError):
                resolve(DOCUMENT, pointer)

    def test_dict_keys_are_not_converted(self):
        self.assertEqual(resolve(DOCUMENT, "/0"), "zero")
        self.assertEqual(resolve({"01": "a", "-1": "b", " ": "c"}, "/01"), "a")
        self.assertEqual(resolve({"01": "a", "-1": "b", " ": "c"}, "/-1"), "b")
        self.assertEqual(resolve({"01": "a", "-1": "b", " ": "c"}, "/ "), "c")

    def test_missing_key(self):
        for pointer in ("/nope", "/A", "/a/nope", "/a/B", "/a/b/2/d", "/a/", "/1", "/e//x"):
            with self.assertRaises(KeyError):
                resolve(DOCUMENT, pointer)
        with self.assertRaises(KeyError):
            resolve({}, "/")

    def test_list_index(self):
        self.assertEqual(resolve([1, 2, 3], "/0"), 1)
        self.assertEqual(resolve([1, 2, 3], "/2"), 3)
        self.assertEqual(resolve(list(range(100, 112)), "/10"), 110)
        self.assertEqual(resolve(list(range(100, 112)), "/11"), 111)

    def test_bad_list_index(self):
        for token in ("-1", "01", "00", "1.5", "+1", "-", "a", "", " 1", "1 ", "0x1", "1e0"):
            with self.assertRaises(ValueError):
                resolve([1, 2, 3], "/" + token)
        with self.assertRaises(ValueError):
            resolve(DOCUMENT, "/a/b/last")
        with self.assertRaises(ValueError):
            resolve(DOCUMENT, "/rows/0/")

    def test_index_past_the_end(self):
        for pointer in ("/3", "/4", "/100"):
            with self.assertRaises(IndexError):
                resolve([1, 2, 3], pointer)
        with self.assertRaises(IndexError):
            resolve([], "/0")
        with self.assertRaises(IndexError):
            resolve(DOCUMENT, "/rows/2/0")

    def test_string_is_never_indexed(self):
        with self.assertRaises(TypeError):
            resolve({"a": "xyz"}, "/a/0")
        with self.assertRaises(TypeError):
            resolve(DOCUMENT, "/s/2")
        with self.assertRaises(TypeError):
            resolve("xyz", "/0")
        with self.assertRaises(TypeError):
            resolve(["ab"], "/0/1")

    def test_token_left_on_a_scalar(self):
        for pointer in ("/n/0", "/n/x", "/f/0", "/t/0", "/t/x", "/z/a", "/z/0", "/n/", "/s/x", "/s/", "/a/b/0/1"):
            with self.assertRaises(TypeError):
                resolve(DOCUMENT, pointer)
        with self.assertRaises(TypeError):
            resolve(5, "/a")
        with self.assertRaises(TypeError):
            resolve(None, "/")

    def test_pointer_must_be_a_string(self):
        for pointer in (None, 0, 1, b"/a", ["a"], ("a",)):
            with self.assertRaises(TypeError):
                resolve(DOCUMENT, pointer)


if __name__ == "__main__":
    unittest.main()
