import unittest

from envfile import parse_env


class HiddenTests(unittest.TestCase):
    def test_reads_pairs(self):
        self.assertEqual(parse_env("A=1\nB=two"), {"A": "1", "B": "two"})
        self.assertEqual(parse_env("A=1\nB=two\n"), {"A": "1", "B": "two"})

    def test_empty_text(self):
        self.assertEqual(parse_env(""), {})

    def test_split_at_first_equals(self):
        self.assertEqual(parse_env("TOKEN=abc=def"), {"TOKEN": "abc=def"})
        self.assertEqual(parse_env('URL="a=b"'), {"URL": "a=b"})
        self.assertEqual(parse_env("K=="), {"K": "="})

    def test_whitespace_is_dropped(self):
        self.assertEqual(parse_env("  A = 1  "), {"A": "1"})
        self.assertEqual(parse_env("  \n  A = 1  \n"), {"A": "1"})
        self.assertEqual(parse_env("\tHOST\t=\tdb\t"), {"HOST": "db"})

    def test_empty_value(self):
        self.assertEqual(parse_env("A="), {"A": ""})
        self.assertEqual(parse_env("A =   \nB=2"), {"A": "", "B": "2"})

    def test_blank_lines(self):
        self.assertEqual(parse_env("A=1\n\n   \n\t\nB=2"), {"A": "1", "B": "2"})

    def test_comments(self):
        self.assertEqual(parse_env("# database\nHOST=db"), {"HOST": "db"})
        self.assertEqual(parse_env("HOST=db\n   # indented = comment\n#PORT=1"), {"HOST": "db"})

    def test_hash_inside_a_value(self):
        self.assertEqual(parse_env("COLOR=#fff"), {"COLOR": "#fff"})
        self.assertEqual(parse_env("NOTE=a # b"), {"NOTE": "a # b"})

    def test_matching_quotes_are_removed(self):
        self.assertEqual(parse_env('NAME="my app"'), {"NAME": "my app"})
        self.assertEqual(parse_env("NAME='my app'"), {"NAME": "my app"})
        self.assertEqual(parse_env('  NAME =  "my app"  '), {"NAME": "my app"})
        self.assertEqual(parse_env('E=""'), {"E": ""})

    def test_whitespace_inside_quotes_is_kept(self):
        self.assertEqual(parse_env('PAD=" x "'), {"PAD": " x "})
        self.assertEqual(parse_env("PAD='  '"), {"PAD": "  "})

    def test_only_one_pair_is_removed(self):
        self.assertEqual(parse_env('A=""x""'), {"A": '"x"'})
        self.assertEqual(parse_env("A=''x''"), {"A": "'x'"})

    def test_unmatched_quotes_are_kept(self):
        self.assertEqual(parse_env('B="x\''), {"B": '"x\''})
        self.assertEqual(parse_env('C="x'), {"C": '"x'})
        self.assertEqual(parse_env("C=x'"), {"C": "x'"})

    def test_single_quote_character_is_kept(self):
        self.assertEqual(parse_env('D="'), {"D": '"'})
        self.assertEqual(parse_env("D = '"), {"D": "'"})

    def test_last_value_wins(self):
        self.assertEqual(parse_env("A=1\nB=2\nA=3"), {"A": "3", "B": "2"})

    def test_line_without_equals(self):
        with self.assertRaises(ValueError):
            parse_env("A=1\nnonsense\nB=2")
        with self.assertRaises(ValueError):
            parse_env("JUSTAKEY")

    def test_empty_key(self):
        with self.assertRaises(ValueError):
            parse_env("=5")
        with self.assertRaises(ValueError):
            parse_env("A=1\n  = 5")


if __name__ == "__main__":
    unittest.main()
