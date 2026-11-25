import unittest

from template import render


class VisibleTests(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(render("Hello {name}!", {"name": "Ada"}), "Hello Ada!")

    def test_two_fields(self):
        self.assertEqual(render("{a}+{b}", {"a": 1, "b": 2}), "1+2")

    def test_no_fields(self):
        self.assertEqual(render("plain text", {}), "plain text")

    def test_missing(self):
        with self.assertRaises(KeyError):
            render("{name}", {})


if __name__ == "__main__":
    unittest.main()
