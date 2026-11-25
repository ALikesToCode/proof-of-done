import unittest

from bytesize import format_size, parse_size


class HiddenTests(unittest.TestCase):
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


    def test_half_rounds_away_from_zero(self):
        self.assertEqual(format_size(1076), "1.1 KiB")
        self.assertEqual(format_size(1075), "1.0 KiB")
        self.assertEqual(format_size(1741), "1.7 KiB")
        self.assertEqual(format_size(1588), "1.6 KiB")
        self.assertEqual(format_size(1126), "1.1 KiB")
        self.assertEqual(format_size(1280), "1.3 KiB")
        self.assertEqual(format_size(2304), "2.3 KiB")
        self.assertEqual(format_size(1792), "1.8 KiB")
        self.assertEqual(format_size(-1280), "-1.3 KiB")
        self.assertEqual(format_size(1024 ** 2 + 256 * 1024), "1.3 MiB")

    def test_roll_over(self):
        self.assertEqual(format_size(1048575), "1.0 MiB")
        self.assertEqual(format_size(1048524), "1023.9 KiB")
        self.assertEqual(format_size(1048525), "1.0 MiB")
        self.assertEqual(format_size(1024 ** 3 - 1), "1.0 GiB")
        self.assertEqual(format_size(1024 ** 2), "1.0 MiB")

    def test_last_unit(self):
        self.assertEqual(format_size(1024 ** 4), "1.0 TiB")
        self.assertEqual(format_size(2048 * 1024 ** 4), "2048.0 TiB")
        self.assertEqual(format_size(1024 ** 5 - 1), "1024.0 TiB")

    def test_negative(self):
        self.assertEqual(format_size(-1536), "-1.5 KiB")
        self.assertEqual(format_size(-1), "-1 B")
        self.assertEqual(format_size(-1076), "-1.1 KiB")

    def test_format_types(self):
        for value in (1.5, "10", None, True):
            with self.assertRaises(TypeError):
                format_size(value)

    def test_parse_forms(self):
        self.assertEqual(parse_size("1.5KiB"), 1536)
        self.assertEqual(parse_size("  2 MiB  "), 2 * 1024 ** 2)
        self.assertEqual(parse_size("0.5 KiB"), 512)
        self.assertEqual(parse_size("-1.5 KiB"), -1536)
        self.assertEqual(parse_size("0 B"), 0)
        self.assertEqual(parse_size("1 TiB"), 1024 ** 4)
        self.assertEqual(parse_size("1.25 MiB"), 1310720)
        self.assertEqual(parse_size("3   GiB"), 3 * 1024 ** 3)

    def test_parse_not_whole(self):
        for text in ("0.1 KiB", "1.5 B", "0.0001 KiB", "1.0 B"):
            with self.assertRaises(ValueError):
                parse_size(text)

    def test_parse_invalid(self):
        for text in ("", "KiB", "1.5", "1.5 kib", "1 KB", "1 kB", "1. KiB", ".5 KiB", "1,5 KiB", "+1 KiB", "1 KiB extra", "1e3 B", "1 PiB"):
            with self.assertRaises(ValueError):
                parse_size(text)

    def test_round_trip(self):
        for count in (0, 1, 1023, 1024, 1536, 10 * 1024 ** 2, 3 * 1024 ** 4):
            self.assertEqual(parse_size(format_size(count)), count)


if __name__ == "__main__":
    unittest.main()
