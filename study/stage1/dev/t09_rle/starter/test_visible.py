import unittest

from rle import decode, encode


class VisibleTests(unittest.TestCase):
    def test_encode(self):
        self.assertEqual(encode("aaabcc"), "3ab2c")
        self.assertEqual(encode(""), "")
        self.assertEqual(encode("abc"), "abc")
        self.assertEqual(encode("x" * 12), "12x")
        self.assertEqual(encode("aabaa"), "2ab2a")

    def test_decode(self):
        self.assertEqual(decode("3ab2c"), "aaabcc")
        self.assertEqual(decode(""), "")
        self.assertEqual(decode("abc"), "abc")
        self.assertEqual(decode("12x"), "x" * 12)

    def test_decode_rejects_count_without_character(self):
        for text in ("3", "a2"):
            with self.assertRaises(ValueError):
                decode(text)

    def test_round_trip(self):
        for text in ("hello  world", "zzzzzzzzzzzzzzzzzzzzzz", "a\n\nb", "--==--"):
            self.assertEqual(decode(encode(text)), text)


if __name__ == "__main__":
    unittest.main()
