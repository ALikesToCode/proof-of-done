import unittest

from envfile import parse_env


class VisibleTests(unittest.TestCase):
    def test_reads_pairs(self):
        self.assertEqual(parse_env("A=1\nB=two"), {"A": "1", "B": "two"})

    def test_skips_empty_lines(self):
        self.assertEqual(parse_env("A=1\n\nB=2"), {"A": "1", "B": "2"})

    def test_skips_comments(self):
        self.assertEqual(parse_env("# database\nHOST=db"), {"HOST": "db"})

    def test_strips_double_quotes(self):
        self.assertEqual(parse_env('NAME="my app"'), {"NAME": "my app"})

    def test_strips_single_quotes(self):
        self.assertEqual(parse_env("NAME='my app'"), {"NAME": "my app"})

    def test_keeps_later_equals(self):
        self.assertEqual(parse_env("TOKEN=abc=def"), {"TOKEN": "abc=def"})


if __name__ == "__main__":
    unittest.main()
