import unittest

from column import column_index, column_name


class VisibleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
