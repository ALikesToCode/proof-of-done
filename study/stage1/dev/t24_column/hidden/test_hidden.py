import unittest

from column import column_index, column_name


class HiddenTests(unittest.TestCase):
    def test_names(self):
        for index, name in ((1, "A"), (26, "Z"), (27, "AA"), (52, "AZ"), (53, "BA"), (702, "ZZ"), (703, "AAA"), (16384, "XFD")):
            self.assertEqual(column_name(index), name)
            self.assertEqual(column_index(name), index)

    def test_lower_case(self):
        self.assertEqual(column_index("aa"), 27)
        self.assertEqual(column_index("xFd"), 16384)

    def test_bad(self):
        for index in (0, -1):
            with self.assertRaises(ValueError):
                column_name(index)
        for name in ("", "A1", "A A", "É", "1", "-"):
            with self.assertRaises(ValueError):
                column_index(name)


    def test_round_trip(self):
        for index in list(range(1, 2000)) + [18278, 18279, 475254, 475255, 10 ** 9]:
            self.assertEqual(column_index(column_name(index)), index)

    def test_boundaries(self):
        self.assertEqual(column_name(18278), "ZZZ")
        self.assertEqual(column_name(18279), "AAAA")
        self.assertEqual(column_name(676), "YZ")
        self.assertEqual(column_name(677), "ZA")
        self.assertEqual(column_index("z"), 26)

    def test_more_bad(self):
        for name in (" A", "A ", "AB_", "ß", "a.b"):
            with self.assertRaises(ValueError):
                column_index(name)


if __name__ == "__main__":
    unittest.main()
