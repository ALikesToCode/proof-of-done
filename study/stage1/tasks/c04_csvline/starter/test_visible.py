import unittest

from csvline import split_line


class VisibleTests(unittest.TestCase):
    def test_plain_fields(self):
        self.assertEqual(split_line("a,b,c"), ["a", "b", "c"])

    def test_strips_spaces(self):
        self.assertEqual(split_line("a , b"), ["a", "b"])

    def test_quoted_comma(self):
        self.assertEqual(split_line('a,"b,c",d'), ["a", "b,c", "d"])

    def test_quoted_address(self):
        self.assertEqual(split_line('1,"12 High St, Leeds",UK'), ["1", "12 High St, Leeds", "UK"])

    def test_doubled_quote(self):
        self.assertEqual(split_line('"say ""hi""",x'), ['say "hi"', "x"])


if __name__ == "__main__":
    unittest.main()
