import unittest

from merge import deep_merge


class VisibleTests(unittest.TestCase):
    def test_reported(self):
        defaults = {"color": "blue", "size": 1}
        result = deep_merge(defaults, {"color": "red"})
        self.assertEqual(result, {"color": "red", "size": 1})
        self.assertEqual(defaults, {"color": "blue", "size": 1})

    def test_nested_merge(self):
        self.assertEqual(deep_merge({"db": {"host": "a", "port": 1}}, {"db": {"port": 2}}), {"db": {"host": "a", "port": 2}})

    def test_new_key(self):
        self.assertEqual(deep_merge({"a": 1}, {"b": 2}), {"a": 1, "b": 2})


if __name__ == "__main__":
    unittest.main()
