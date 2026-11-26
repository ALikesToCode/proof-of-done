import unittest

from merge import deep_merge


class HiddenTests(unittest.TestCase):
    def test_reported(self):
        defaults = {"color": "blue", "size": 1}
        result = deep_merge(defaults, {"color": "red"})
        self.assertEqual(result, {"color": "red", "size": 1})
        self.assertEqual(defaults, {"color": "blue", "size": 1})

    def test_nested_merge(self):
        self.assertEqual(deep_merge({"db": {"host": "a", "port": 1}}, {"db": {"port": 2}}), {"db": {"host": "a", "port": 2}})

    def test_new_key(self):
        self.assertEqual(deep_merge({"a": 1}, {"b": 2}), {"a": 1, "b": 2})


    def test_nested_base_not_changed(self):
        base = {"db": {"host": "a", "opts": {"x": 1}}, "tags": ["t"]}
        deep_merge(base, {"db": {"host": "b", "opts": {"y": 2}}, "tags": ["u"]})
        self.assertEqual(base, {"db": {"host": "a", "opts": {"x": 1}}, "tags": ["t"]})

    def test_override_not_changed(self):
        override = {"db": {"opts": {"y": 2}}, "gone": None}
        deep_merge({"db": {"opts": {"x": 1}}, "gone": 1}, override)
        self.assertEqual(override, {"db": {"opts": {"y": 2}}, "gone": None})

    def test_result_shares_nothing(self):
        base = {"keep": {"inner": [1, 2]}, "list": [{"a": 1}]}
        override = {"new": {"deep": {"n": [3]}}, "other": [4]}
        result = deep_merge(base, override)
        result["keep"]["inner"].append(99)
        result["list"][0]["a"] = 99
        result["new"]["deep"]["n"].append(99)
        result["other"].append(99)
        self.assertEqual(base, {"keep": {"inner": [1, 2]}, "list": [{"a": 1}]})
        self.assertEqual(override, {"new": {"deep": {"n": [3]}}, "other": [4]})

    def test_lists_are_replaced(self):
        self.assertEqual(deep_merge({"a": [1, 2]}, {"a": [3]}), {"a": [3]})

    def test_type_changes(self):
        self.assertEqual(deep_merge({"a": {"x": 1}}, {"a": 5}), {"a": 5})
        self.assertEqual(deep_merge({"a": 5}, {"a": {"x": 1}}), {"a": {"x": 1}})
        self.assertEqual(deep_merge({"a": {"x": 1}}, {"a": [1]}), {"a": [1]})

    def test_none_removes(self):
        self.assertEqual(deep_merge({"a": 1, "b": 2}, {"a": None}), {"b": 2})
        self.assertEqual(deep_merge({"a": 1}, {"zzz": None}), {"a": 1})
        self.assertEqual(deep_merge({"db": {"host": "a", "port": 1}}, {"db": {"port": None}}), {"db": {"host": "a"}})
        self.assertEqual(deep_merge({"db": {"host": "a"}}, {"db": None}), {})

    def test_none_in_base_is_kept(self):
        self.assertEqual(deep_merge({"a": None}, {"b": 1}), {"a": None, "b": 1})

    def test_key_order(self):
        self.assertEqual(list(deep_merge({"b": 1, "a": 2}, {"z": 0, "a": 3, "c": 4})), ["b", "a", "z", "c"])

    def test_empty(self):
        self.assertEqual(deep_merge({}, {}), {})
        self.assertEqual(deep_merge({"a": {"b": {}}}, {}), {"a": {"b": {}}})
        base = {"a": {}}
        self.assertIsNot(deep_merge(base, {})["a"], base["a"])


if __name__ == "__main__":
    unittest.main()
