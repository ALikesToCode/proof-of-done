import unittest

from record import format_record, parse_record


class VisibleTests(unittest.TestCase):
    def test_plain_fields(self):
        self.assertEqual(parse_record("a,b,c"), ["a", "b", "c"])

    def test_quoted_field_with_delimiter(self):
        self.assertEqual(parse_record('a,"b,c",d'), ["a", "b,c", "d"])

    def test_doubled_quote(self):
        self.assertEqual(parse_record('"say ""hi"""'), ['say "hi"'])

    def test_other_delimiter(self):
        self.assertEqual(parse_record("a;b", delimiter=";"), ["a", "b"])

    def test_format_plain(self):
        self.assertEqual(format_record(["a", "b"]), "a,b")

    def test_format_quotes_when_needed(self):
        self.assertEqual(format_record(["a,b", "c"]), '"a,b",c')


if __name__ == "__main__":
    unittest.main()
