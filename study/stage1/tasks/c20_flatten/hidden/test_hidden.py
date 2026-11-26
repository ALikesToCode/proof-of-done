import unittest

from nested import flatten


class HiddenTests(unittest.TestCase):
    def test_default_is_complete(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]]), [1, 2, 3, 4])
        self.assertEqual(flatten([1, [2, [3]]], depth=None), [1, 2, 3])
        self.assertEqual(flatten([[[1], 2], [[[3]]], 4]), [1, 2, 3, 4])

    def test_flat_and_empty(self):
        self.assertEqual(flatten([1, 2, 3]), [1, 2, 3])
        self.assertEqual(flatten([]), [])
        self.assertEqual(flatten([], depth=1), [])
        self.assertEqual(flatten([1, 2, 3], depth=2), [1, 2, 3])

    def test_one_level(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]], depth=1), [1, 2, [3, [4]]])
        self.assertEqual(flatten([[1, [2]], [[3], 4]], depth=1), [1, [2], [3], 4])

    def test_two_levels(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]], depth=2), [1, 2, 3, [4]])

    def test_three_levels(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]], depth=3), [1, 2, 3, 4])
        self.assertEqual(flatten([[[[[5]]]]], depth=3), [[5]])

    def test_zero_levels(self):
        self.assertEqual(flatten([1, [2, [3]]], depth=0), [1, [2, [3]]])
        self.assertEqual(flatten([[1], [2]], depth=0), [[1], [2]])

    def test_zero_levels_gives_a_new_list_of_the_same_objects(self):
        inner = [2, [3]]
        items = [1, inner]
        result = flatten(items, depth=0)
        self.assertIsNot(result, items)
        self.assertEqual(len(result), 2)
        self.assertIs(result[1], inner)

    def test_depth_larger_than_the_nesting(self):
        self.assertEqual(flatten([1, [2, [3]]], depth=10), [1, 2, 3])
        self.assertEqual(flatten([1, 2], depth=5), [1, 2])

    def test_negative_depth(self):
        with self.assertRaises(ValueError):
            flatten([1], depth=-1)
        with self.assertRaises(ValueError):
            flatten([1, [2]], depth=-3)

    def test_negative_depth_on_an_empty_list(self):
        with self.assertRaises(ValueError):
            flatten([], depth=-1)

    def test_strings_stay_whole(self):
        self.assertEqual(flatten(["ab", ["cd"]], depth=1), ["ab", "cd"])
        self.assertEqual(flatten(["ab", ["cd", ["ef"]]]), ["ab", "cd", "ef"])

    def test_tuples_and_other_values_stay_whole(self):
        self.assertEqual(flatten([(1, 2), [3]]), [(1, 2), 3])
        self.assertEqual(flatten([[(1, [2])], {"a": [1]}, None], depth=1), [(1, [2]), {"a": [1]}, None])

    def test_empty_lists(self):
        self.assertEqual(flatten([1, [], [[]]]), [1])
        self.assertEqual(flatten([1, [], [[]]], depth=1), [1, []])
        self.assertEqual(flatten([1, [], [[]]], depth=2), [1])

    def test_result_is_a_new_list(self):
        items = [1, 2, 3]
        result = flatten(items)
        self.assertIsNot(result, items)
        self.assertIs(type(result), list)
        self.assertIsNot(flatten(items, depth=1), items)

    def test_input_is_not_changed(self):
        items = [1, [2, [3, [4]]], []]
        flatten(items)
        self.assertEqual(items, [1, [2, [3, [4]]], []])
        flatten(items, depth=1)
        self.assertEqual(items, [1, [2, [3, [4]]], []])
        result = flatten(items, depth=2)
        result.append(9)
        self.assertEqual(items, [1, [2, [3, [4]]], []])


if __name__ == "__main__":
    unittest.main()
