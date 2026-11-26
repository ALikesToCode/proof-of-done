import unittest

from template import render


class HiddenTests(unittest.TestCase):
    def test_plain(self):
        self.assertEqual(render("Hello {name}!", {"name": "Ada"}), "Hello Ada!")

    def test_two_fields(self):
        self.assertEqual(render("{a}+{b}", {"a": 1, "b": 2}), "1+2")

    def test_no_fields(self):
        self.assertEqual(render("plain text", {}), "plain text")

    def test_missing(self):
        with self.assertRaises(KeyError):
            render("{name}", {})


    def test_dotted(self):
        values = {"user": {"name": "Ada", "tags": ["x", "y"], "pair": ("p", "q")}, "n": {"0": "zero"}}
        self.assertEqual(render("{user.name}", values), "Ada")
        self.assertEqual(render("{user.tags.1}", values), "y")
        self.assertEqual(render("{user.pair.0}", values), "p")
        self.assertEqual(render("{n.0}", values), "zero")
        self.assertEqual(render("{ user.name }", values), "Ada")

    def test_special_values(self):
        self.assertEqual(render("[{a}]", {"a": None}), "[]")
        self.assertEqual(render("{a} {b}", {"a": True, "b": False}), "true false")
        self.assertEqual(render("{a}", {"a": 1.5}), "1.5")
        self.assertEqual(render("{a}", {"a": [1, 2]}), "[1, 2]")
        self.assertEqual(render("{a|x}", {"a": None}), "")
        self.assertEqual(render("{a|x}", {"a": 0}), "0")

    def test_defaults(self):
        self.assertEqual(render("{name|stranger}", {}), "stranger")
        self.assertEqual(render("{name| a b }", {}), " a b ")
        self.assertEqual(render("[{name|}]", {}), "[]")
        self.assertEqual(render("{user.name|?}", {"user": {}}), "?")
        self.assertEqual(render("{user.name|?}", {"user": "text"}), "?")
        self.assertEqual(render("{items.5|none}", {"items": [1]}), "none")
        self.assertEqual(render("{items.x|none}", {"items": [1]}), "none")
        self.assertEqual(render("{name|a|b}", {}), "a|b")
        self.assertEqual(render("{name|stranger}", {"name": "Ada"}), "Ada")

    def test_key_error_names_the_path(self):
        for template, path in (("{name}", "name"), ("{ user.name }", "user.name"), ("{items.3}", "items.3"), ("{a.b.c}", "a.b.c")):
            with self.assertRaises(KeyError) as caught:
                render(template, {"user": {}, "items": [1], "a": {"b": 5}})
            self.assertEqual(caught.exception.args[0], path)

    def test_no_attribute_lookup(self):
        with self.assertRaises(KeyError):
            render("{text.upper}", {"text": "abc"})
        with self.assertRaises(KeyError):
            render("{d.keys}", {"d": {}})
        with self.assertRaises(KeyError):
            render("{items.-1}".replace("-1", "x1"), {"items": [1, 2]})

    def test_escaped_braces(self):
        self.assertEqual(render("{{name}}", {"name": "Ada"}), "{name}")
        self.assertEqual(render("{{{name}}}", {"name": "Ada"}), "{Ada}")
        self.assertEqual(render("a }} b {{ c", {}), "a } b { c")
        self.assertEqual(render("{{}}", {}), "{}")

    def test_malformed(self):
        for template in ("{name", "name}", "{}", "{ }", "{a..b}", "{a-b}", "{.a}", "{a.}", "{a{b}}", "a } b", "{a b}", "{|x}"):
            with self.assertRaises(ValueError):
                render(template, {"a": {"b": 1}, "name": "x"})

    def test_no_rescan(self):
        self.assertEqual(render("{a}", {"a": "{b}", "b": "no"}), "{b}")
        self.assertEqual(render("{a|{{x}}}".replace("{{x}}", "x"), {}), "x")
        self.assertEqual(render("{a}{a}", {"a": "}"}), "}}")


if __name__ == "__main__":
    unittest.main()
