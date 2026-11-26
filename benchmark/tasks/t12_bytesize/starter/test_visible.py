import unittest

from bytesize import format_size, parse_size


class VisibleTests(unittest.TestCase):
    def test_bytes(self):
        self.assertEqual(format_size(0), "0 B")
        self.assertEqual(format_size(1023), "1023 B")

    def test_units(self):
        self.assertEqual(format_size(1024), "1.0 KiB")
        self.assertEqual(format_size(1536), "1.5 KiB")
        self.assertEqual(format_size(5 * 1024 ** 3), "5.0 GiB")

    def test_parse(self):
        self.assertEqual(parse_size("1.5 KiB"), 1536)
        self.assertEqual(parse_size("10 B"), 10)
        with self.assertRaises(ValueError):
            parse_size("ten bytes")


if __name__ == "__main__":
    unittest.main()
