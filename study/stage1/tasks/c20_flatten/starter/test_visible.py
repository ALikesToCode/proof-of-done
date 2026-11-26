import unittest

from nested import flatten


class VisibleTests(unittest.TestCase):
    def test_flattens_completely(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]]), [1, 2, 3, 4])

    def test_flat_list_unchanged(self):
        self.assertEqual(flatten([1, 2, 3]), [1, 2, 3])

    def test_one_level(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]], depth=1), [1, 2, [3, [4]]])

    def test_two_levels(self):
        self.assertEqual(flatten([1, [2, [3, [4]]]], depth=2), [1, 2, 3, [4]])

    def test_strings_stay_whole(self):
        self.assertEqual(flatten(["ab", ["cd"]], depth=1), ["ab", "cd"])

    def test_negative_depth(self):
        with self.assertRaises(ValueError):
            flatten([1], depth=-1)


if __name__ == "__main__":
    unittest.main()
