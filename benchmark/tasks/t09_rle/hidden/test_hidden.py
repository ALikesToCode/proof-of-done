import unittest

from rle import decode, encode


class HiddenTests(unittest.TestCase):
    def test_encode(self):
        self.assertEqual(encode("aaabcc"), "3ab2c")
        self.assertEqual(encode(""), "")
        self.assertEqual(encode("a"), "a")
        self.assertEqual(encode("aa"), "2a")
        self.assertEqual(encode("abc"), "abc")
        self.assertEqual(encode("aabaa"), "2ab2a")
        self.assertEqual(encode("x" * 100), "100x")
        self.assertEqual(encode("   "), "3 ")
        self.assertEqual(encode("aAa"), "aAa")
        self.assertEqual(encode("\n\n"), "2\n")

    def test_encode_rejects_digits(self):
        for text in ("a1", "0", "ab9c", "5", "aa7"):
            with self.assertRaises(ValueError):
                encode(text)

    def test_decode(self):
        self.assertEqual(decode("3ab2c"), "aaabcc")
        self.assertEqual(decode(""), "")
        self.assertEqual(decode("abc"), "abc")
        self.assertEqual(decode("12x"), "x" * 12)
        self.assertEqual(decode("100x2y"), "x" * 100 + "yy")
        self.assertEqual(decode("3 "), "   ")
        self.assertEqual(decode("10a"), "a" * 10)
        self.assertEqual(decode("20a"), "a" * 20)

    def test_decode_rejects_bad_counts(self):
        for text in ("1a", "0a", "02a", "3", "a2", "2a3", "00a", "01", "a1b", "a0b", "012x", "5"):
            with self.assertRaises(ValueError):
                decode(text)

    def test_round_trip(self):
        for text in ("hello  world", "z" * 22, "a\n\nb", "--==--", "aaAAaa", " ", "mississippi", "é" * 3 + "e"):
            self.assertEqual(decode(encode(text)), text)


if __name__ == "__main__":
    unittest.main()
