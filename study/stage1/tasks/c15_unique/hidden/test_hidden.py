import unittest

from dedupe import unique


class HiddenTests(unittest.TestCase):
    def test_keeps_first_seen_order(self):
        self.assertEqual(unique([3, 1, 3, 2, 1]), [3, 1, 2])
        self.assertEqual(unique(["pear", "apple", "pear"]), ["pear", "apple"])

    def test_no_duplicates(self):
        self.assertEqual(unique([5, 4, 9]), [5, 4, 9])
        self.assertEqual(unique([]), [])

    def test_all_the_same(self):
        self.assertEqual(unique([7, 7, 7]), [7])

    def test_equal_numbers_are_duplicates(self):
        result = unique([1, 1.0, True, 2])
        self.assertEqual(result, [1, 2])
        self.assertIs(type(result[0]), int)
        self.assertEqual(unique([0.0, 0, False]), [0.0])
        self.assertIs(type(unique([0.0, 0, False])[0]), float)

    def test_key(self):
        self.assertEqual(unique(["a", "A", "b"], key=str.lower), ["a", "b"])
        self.assertEqual(unique(["B", "a", "b", "A"], key=str.lower), ["B", "a"])

    def test_key_on_records(self):
        rows = [{"id": 2, "n": "x"}, {"id": 1, "n": "y"}, {"id": 2, "n": "z"}]
        result = unique(rows, key=lambda row: row["id"])
        self.assertEqual(result, rows[:2])
        self.assertIs(result[0], rows[0])

    def test_key_keeps_items_not_keys(self):
        self.assertEqual(unique([10, 21, 32, 43], key=lambda n: n % 2), [10, 21])

    def test_lists_as_items(self):
        self.assertEqual(unique([[1], [2], [1]]), [[1], [2]])
        self.assertEqual(unique([[1, 2], [1, 2], []]), [[1, 2], []])

    def test_dicts_as_items(self):
        self.assertEqual(unique([{"a": 1}, {"b": 2}, {"a": 1}]), [{"a": 1}, {"b": 2}])

    def test_unhashable_keys(self):
        rows = [("x", [1, 2]), ("y", [3]), ("z", [1, 2])]
        self.assertEqual(unique(rows, key=lambda row: row[1]), rows[:2])
        people = [{"name": "Ann", "tags": {"a": 1}}, {"name": "Bo", "tags": {"a": 1}}]
        self.assertEqual(unique(people, key=lambda person: person["tags"]), people[:1])

    def test_any_iterable(self):
        self.assertEqual(unique("banana"), ["b", "a", "n"])
        self.assertEqual(unique((2, 2, 1)), [2, 1])
        self.assertEqual(unique(n % 3 for n in range(7)), [0, 1, 2])

    def test_result_is_a_new_list(self):
        items = [1, 2, 3]
        result = unique(items)
        self.assertIs(type(result), list)
        self.assertIsNot(result, items)
        self.assertIs(type(unique((1, 1))), list)

    def test_items_is_not_changed(self):
        items = [3, 1, 3, 2, 1]
        unique(items)
        self.assertEqual(items, [3, 1, 3, 2, 1])
        words = ["a", "A"]
        unique(words, key=str.lower)
        self.assertEqual(words, ["a", "A"])

    def test_key_called_once_per_item(self):
        seen = []

        def key(item):
            seen.append(item)
            return item.lower()

        self.assertEqual(unique(["a", "A", "b", "a"], key=key), ["a", "b"])
        self.assertEqual(seen, ["a", "A", "b", "a"])

    def test_none_and_zero_as_keys(self):
        self.assertEqual(unique([1, 2, 3], key=lambda n: None), [1])
        self.assertEqual(unique([4, 5, 6], key=lambda n: 0), [4])
        self.assertEqual(unique(["x", "", "y"], key=len), ["x", ""])

    def test_none_as_an_item(self):
        self.assertEqual(unique([None, 1, None]), [None, 1])


if __name__ == "__main__":
    unittest.main()
