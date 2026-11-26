import unittest

from intervals import merge


class HiddenTests(unittest.TestCase):
    def test_overlapping(self):
        self.assertEqual(merge([(1, 3), (2, 5)]), [(1, 5)])

    def test_apart(self):
        self.assertEqual(merge([(1, 2), (4, 5)]), [(1, 2), (4, 5)])

    def test_touching(self):
        self.assertEqual(merge([(9, 10), (10, 11)]), [(9, 11)])

    def test_chain(self):
        self.assertEqual(merge([(1, 2), (2, 3), (3, 4)]), [(1, 4)])
        self.assertEqual(merge([(1, 4), (3, 6), (5, 8)]), [(1, 8)])

    def test_out_of_order(self):
        self.assertEqual(merge([(5, 7), (1, 3), (3, 4)]), [(1, 4), (5, 7)])
        self.assertEqual(merge([(10, 11), (9, 10)]), [(9, 11)])

    def test_result_sorted_by_start(self):
        self.assertEqual(merge([(8, 9), (1, 2), (4, 5)]), [(1, 2), (4, 5), (8, 9)])

    def test_contained(self):
        self.assertEqual(merge([(1, 10), (2, 3)]), [(1, 10)])
        self.assertEqual(merge([(2, 3), (1, 10)]), [(1, 10)])

    def test_contained_then_later(self):
        self.assertEqual(merge([(1, 10), (2, 3), (4, 5)]), [(1, 10)])
        self.assertEqual(merge([(1, 10), (2, 3), (9, 12), (20, 21)]), [(1, 12), (20, 21)])

    def test_same_interval_twice(self):
        self.assertEqual(merge([(1, 2), (1, 2)]), [(1, 2)])

    def test_point_alone(self):
        self.assertEqual(merge([(5, 5)]), [(5, 5)])
        self.assertEqual(merge([(5, 5), (1, 2)]), [(1, 2), (5, 5)])

    def test_point_touching(self):
        self.assertEqual(merge([(1, 3), (3, 3)]), [(1, 3)])
        self.assertEqual(merge([(3, 3), (3, 5)]), [(3, 5)])

    def test_point_inside_another(self):
        self.assertEqual(merge([(1, 5), (3, 3)]), [(1, 5)])

    def test_end_before_start(self):
        for intervals in ([(3, 1)], [(1, 2), (5, 4)], [(5, 4), (1, 2)], [(1, 2), (9, 8), (3, 4)]):
            with self.assertRaises(ValueError):
                merge(intervals)

    def test_input_not_changed(self):
        intervals = [(5, 7), (1, 3), (3, 4)]
        merge(intervals)
        self.assertEqual(intervals, [(5, 7), (1, 3), (3, 4)])

    def test_result_is_a_new_list(self):
        intervals = [(1, 2)]
        result = merge(intervals)
        self.assertEqual(result, [(1, 2)])
        self.assertIsNot(result, intervals)

    def test_lists_as_pairs(self):
        result = merge([[1, 2], [2, 3]])
        self.assertEqual(result, [(1, 3)])
        self.assertIs(type(result[0]), tuple)
        result = merge([[4, 5], [1, 2]])
        self.assertEqual(result, [(1, 2), (4, 5)])
        for pair in result:
            self.assertIs(type(pair), tuple)

    def test_lists_not_changed(self):
        intervals = [[4, 5], [1, 2], [2, 3]]
        merge(intervals)
        self.assertEqual(intervals, [[4, 5], [1, 2], [2, 3]])

    def test_empty(self):
        self.assertEqual(merge([]), [])


if __name__ == "__main__":
    unittest.main()
