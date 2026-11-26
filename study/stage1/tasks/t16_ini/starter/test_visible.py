import unittest

from ini import parse_ini


class VisibleTests(unittest.TestCase):
    def test_sections_and_keys(self):
        self.assertEqual(parse_ini("[db]\nhost = localhost\nport = 5432\n"), {"db": {"host": "localhost", "port": "5432"}})

    def test_comments_and_blanks(self):
        self.assertEqual(parse_ini("; settings\n\n[a]\n# note\nx = 1\n"), {"a": {"x": "1"}})

    def test_two_sections(self):
        self.assertEqual(parse_ini("[a]\nx=1\n[b]\ny=2"), {"a": {"x": "1"}, "b": {"y": "2"}})

    def test_bad_line(self):
        with self.assertRaises(ValueError):
            parse_ini("[a]\nnonsense\n")


if __name__ == "__main__":
    unittest.main()
