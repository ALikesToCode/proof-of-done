import unittest

from record import format_record, parse_record


class HiddenTests(unittest.TestCase):
    def bad_parse(self, text, delimiter=","):
        with self.assertRaises(ValueError):
            parse_record(text, delimiter)

    def test_visible_cases(self):
        self.assertEqual(parse_record("a,b,c"), ["a", "b", "c"])
        self.assertEqual(parse_record('a,"b,c",d'), ["a", "b,c", "d"])
        self.assertEqual(parse_record('"say ""hi"""'), ['say "hi"'])
        self.assertEqual(parse_record("a;b", delimiter=";"), ["a", "b"])
        self.assertEqual(format_record(["a", "b"]), "a,b")
        self.assertEqual(format_record(["a,b", "c"]), '"a,b",c')

    def test_empty_fields(self):
        self.assertEqual(parse_record(""), [""])
        self.assertEqual(parse_record("a,,b"), ["a", "", "b"])
        self.assertEqual(parse_record("a,"), ["a", ""])
        self.assertEqual(parse_record(","), ["", ""])
        self.assertEqual(parse_record('""'), [""])
        self.assertEqual(parse_record('"",""'), ["", ""])
        self.assertEqual(parse_record('"a",'), ["a", ""])

    def test_spaces_are_kept(self):
        self.assertEqual(parse_record(" a , b "), [" a ", " b "])
        self.assertEqual(parse_record('" a "'), [" a "])
        self.assertEqual(parse_record("   "), ["   "])

    def test_quoted_newlines(self):
        self.assertEqual(parse_record('"line1\nline2",x'), ["line1\nline2", "x"])
        self.assertEqual(parse_record('"a\r\nb"'), ["a\r\nb"])

    def test_quoted_only_quotes(self):
        self.assertEqual(parse_record('""""'), ['"'])
        self.assertEqual(parse_record('"a""",b'), ['a"', "b"])

    def test_text_after_closing_quote(self):
        self.bad_parse('"a"b')
        self.bad_parse('"a" ,b')
        self.bad_parse('"a""b"c,d')

    def test_unterminated_quote(self):
        self.bad_parse('"abc')
        self.bad_parse('a,"b')
        self.bad_parse('"a""')

    def test_quote_inside_unquoted_field(self):
        self.bad_parse('ab"c')
        self.bad_parse('a,b"')
        self.bad_parse(' "a"')

    def test_bare_newline(self):
        self.bad_parse("a\nb")
        self.bad_parse("a,b\r")
        self.bad_parse("a,b\n")

    def test_other_delimiters(self):
        self.assertEqual(parse_record("a,b;c", ";"), ["a,b", "c"])
        self.assertEqual(parse_record("a\tb", "\t"), ["a", "b"])
        self.assertEqual(parse_record('"a|b"|c', "|"), ["a|b", "c"])
        self.assertEqual(parse_record("a b", " "), ["a", "b"])

    def test_bad_delimiter(self):
        for delimiter in ("", ",,", '"', "\n", "\r"):
            with self.assertRaises(ValueError):
                parse_record("a", delimiter)
            with self.assertRaises(ValueError):
                format_record(["a"], delimiter)

    def test_format_quoting(self):
        self.assertEqual(format_record(['say "hi"']), '"say ""hi"""')
        self.assertEqual(format_record(["a\nb"]), '"a\nb"')
        self.assertEqual(format_record(["a\rb"]), '"a\rb"')
        self.assertEqual(format_record([" a"]), '" a"')
        self.assertEqual(format_record(["a "]), '"a "')
        self.assertEqual(format_record(["a b"]), "a b")

    def test_format_empty_and_plain(self):
        self.assertEqual(format_record([""]), "")
        self.assertEqual(format_record(["", ""]), ",")
        self.assertEqual(format_record(["a", "", "b"]), "a,,b")
        self.assertEqual(format_record(["a;b"]), "a;b")

    def test_format_other_delimiter(self):
        self.assertEqual(format_record(["a;b", "c,d"], ";"), '"a;b";c,d')
        self.assertEqual(format_record(["a b", "c"], " "), '"a b" c')

    def test_format_bad_fields(self):
        with self.assertRaises(ValueError):
            format_record([])
        with self.assertRaises(ValueError):
            format_record(["a", 1])
        with self.assertRaises(ValueError):
            format_record([None])

    def test_round_trip(self):
        cases = [
            ["a", "b"],
            [""],
            ["", "", ""],
            [' padded ', 'q"uote', "multi\nline", "x,y", "\r"],
            ['"', '""', ","],
            ["tab\there", " "],
        ]
        for fields in cases:
            for delimiter in (",", ";", "\t", " "):
                self.assertEqual(parse_record(format_record(fields, delimiter), delimiter), fields)
        self.assertEqual(parse_record(format_record(("a", "b,c"))), ["a", "b,c"])


if __name__ == "__main__":
    unittest.main()
