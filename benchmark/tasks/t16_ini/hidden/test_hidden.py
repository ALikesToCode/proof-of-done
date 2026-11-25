import unittest

from ini import parse_ini


class HiddenTests(unittest.TestCase):
    def test_sections_and_keys(self):
        self.assertEqual(parse_ini("[db]\nhost = localhost\nport = 5432\n"), {"db": {"host": "localhost", "port": "5432"}})

    def test_comments_and_blanks(self):
        self.assertEqual(parse_ini("; settings\n\n[a]\n# note\nx = 1\n"), {"a": {"x": "1"}})

    def test_two_sections(self):
        self.assertEqual(parse_ini("[a]\nx=1\n[b]\ny=2"), {"a": {"x": "1"}, "b": {"y": "2"}})

    def test_bad_line(self):
        with self.assertRaises(ValueError):
            parse_ini("[a]\nnonsense\n")


    def test_error_names_the_line(self):
        for text, line in (("[a]\nnonsense\n", 2), ("x = 1\n\n; c\noops", 4), ("[]\n", 1), ("[a]\n= 5", 2), ("[a\n", 1), ("[a] x\n", 1)):
            with self.assertRaises(ValueError) as caught:
                parse_ini(text)
            self.assertIn(f"line {line}", str(caught.exception))

    def test_comment_only_at_line_start(self):
        self.assertEqual(parse_ini("[a]\nurl = http://x/#top ; note\n"), {"a": {"url": "http://x/#top ; note"}})
        self.assertEqual(parse_ini("[a]\n  ; indented comment\n\t# another\nx = 1"), {"a": {"x": "1"}})

    def test_split_at_first_equals(self):
        self.assertEqual(parse_ini("[a]\nexpr = a = b\n"), {"a": {"expr": "a = b"}})
        self.assertEqual(parse_ini("[a]\nk==\n"), {"a": {"k": "="}})

    def test_trimming_and_case(self):
        self.assertEqual(parse_ini("[ Db ]\n  \n Host =  Local Host  \n".replace("\n Host", "\nHost")), {"Db": {"host": "Local Host"}})
        self.assertEqual(parse_ini("[a]\nKEY=V\nkey=w"), {"a": {"key": "w"}})

    def test_empty_value(self):
        self.assertEqual(parse_ini("[a]\nx =\ny=   \n"), {"a": {"x": "", "y": ""}})

    def test_global_section(self):
        self.assertEqual(parse_ini("top = 1\n[a]\nx = 2"), {"": {"top": "1"}, "a": {"x": "2"}})
        self.assertEqual(parse_ini(""), {})
        self.assertEqual(parse_ini("; only a comment\n\n"), {})
        self.assertNotIn("", parse_ini("[a]\nx = 1"))

    def test_continuation(self):
        self.assertEqual(parse_ini("[a]\ntext = one\n  two\n\tthree\nz = 1"), {"a": {"text": "one\ntwo\nthree", "z": "1"}})
        self.assertEqual(parse_ini("[a]\ntext =\n  two"), {"a": {"text": "\ntwo"}})
        self.assertEqual(parse_ini("[a]\nx = 1\n  k = v"), {"a": {"x": "1\nk = v"}})

    def test_continuation_without_key(self):
        for text, line in (("  lost\n", 1), ("[a]\n  lost\n", 2), ("[a]\nx = 1\n[b]\n  lost", 4)):
            with self.assertRaises(ValueError) as caught:
                parse_ini(text)
            self.assertIn(f"line {line}", str(caught.exception))

    def test_duplicates(self):
        self.assertEqual(parse_ini("[a]\nx = 1\nx = 2"), {"a": {"x": "2"}})
        self.assertEqual(parse_ini("[a]\nx = 1\ny = 1\n[b]\nz = 0\n[a]\ny = 2\nw = 3"), {"a": {"x": "1", "y": "2", "w": "3"}, "b": {"z": "0"}})

    def test_empty_section_and_names(self):
        self.assertEqual(parse_ini("[a]\n[b]\nx = 1"), {"a": {}, "b": {"x": "1"}})
        self.assertEqual(parse_ini("[A]\n[a]"), {"A": {}, "a": {}})
        self.assertEqual(parse_ini("[ spaced name ]  \nx=1"), {"spaced name": {"x": "1"}})

    def test_line_endings(self):
        self.assertEqual(parse_ini("[a]\r\nx = 1\r\ny = 2"), {"a": {"x": "1", "y": "2"}})


if __name__ == "__main__":
    unittest.main()
