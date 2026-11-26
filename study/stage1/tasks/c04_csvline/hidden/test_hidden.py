import unittest

from csvline import split_line


class HiddenTests(unittest.TestCase):
    def bad(self, line):
        with self.assertRaises(ValueError):
            split_line(line)

    def test_plain_fields(self):
        self.assertEqual(split_line("a,b,c"), ["a", "b", "c"])
        self.assertEqual(split_line("one"), ["one"])

    def test_empty_fields(self):
        self.assertEqual(split_line("a,,b"), ["a", "", "b"])
        self.assertEqual(split_line("a,"), ["a", ""])
        self.assertEqual(split_line(",a"), ["", "a"])
        self.assertEqual(split_line(""), [""])

    def test_spaces_and_tabs_dropped(self):
        self.assertEqual(split_line("a , b"), ["a", "b"])
        self.assertEqual(split_line("\ta\t,  b c  "), ["a", "b c"])
        self.assertEqual(split_line("a,  ,b"), ["a", "", "b"])

    def test_quoted_comma(self):
        self.assertEqual(split_line('a,"b,c",d'), ["a", "b,c", "d"])
        self.assertEqual(split_line('"a,b,c"'), ["a,b,c"])

    def test_quoted_address(self):
        self.assertEqual(split_line('1,"12 High St, Leeds",UK'), ["1", "12 High St, Leeds", "UK"])

    def test_quoted_field_without_comma(self):
        self.assertEqual(split_line('"a",b'), ["a", "b"])
        self.assertEqual(split_line('a,"b"'), ["a", "b"])

    def test_quoted_empty_field(self):
        self.assertEqual(split_line('"",x'), ["", "x"])
        self.assertEqual(split_line('""'), [""])

    def test_doubled_quote(self):
        self.assertEqual(split_line('"say ""hi""",x'), ['say "hi"', "x"])
        self.assertEqual(split_line('"a""b"'), ['a"b'])
        self.assertEqual(split_line('x,""""'), ["x", '"'])

    def test_spaces_inside_quotes_are_kept(self):
        self.assertEqual(split_line('" a ",b'), [" a ", "b"])
        self.assertEqual(split_line('x,"  lead"'), ["x", "  lead"])
        self.assertEqual(split_line('"trail\t",x'), ["trail\t", "x"])

    def test_quoted_spaces_only(self):
        self.assertEqual(split_line('"  ",x'), ["  ", "x"])

    def test_spaces_outside_quotes_dropped(self):
        self.assertEqual(split_line('a, "b,c" ,d'), ["a", "b,c", "d"])
        self.assertEqual(split_line(' "a"\t'), ["a"])

    def test_unclosed_quote(self):
        self.bad('a,"b')
        self.bad('"abc')
        self.bad('"a,b')

    def test_text_after_closing_quote(self):
        self.bad('"a"b,c')
        self.bad('x,"a" b')

    def test_text_before_opening_quote(self):
        self.bad('ab"c",d')
        self.bad('x,a "b"')


if __name__ == "__main__":
    unittest.main()
