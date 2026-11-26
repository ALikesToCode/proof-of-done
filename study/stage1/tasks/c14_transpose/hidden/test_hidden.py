import unittest

from grid import transpose


class HiddenTests(unittest.TestCase):
    def test_square(self):
        self.assertEqual(transpose([[1, 2], [3, 4]]), [[1, 3], [2, 4]])
        self.assertEqual(transpose([[7]]), [[7]])

    def test_wide(self):
        self.assertEqual(transpose([[1, 2, 3], [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])

    def test_tall(self):
        self.assertEqual(transpose([[1], [2], [3]]), [[1, 2, 3]])
        self.assertEqual(transpose([[1, 2], [3, 4], [5, 6]]), [[1, 3, 5], [2, 4, 6]])

    def test_single_row(self):
        self.assertEqual(transpose([[1, 2, 3]]), [[1], [2], [3]])

    def test_twice_gives_the_table_back(self):
        table = [[1, 2, 3], [4, 5, 6]]
        self.assertEqual(transpose(transpose(table)), table)

    def test_empty_table(self):
        self.assertEqual(transpose([]), [])

    def test_rows_all_empty(self):
        self.assertEqual(transpose([[], []]), [])
        self.assertEqual(transpose([[]]), [])

    def test_later_row_shorter(self):
        with self.assertRaises(ValueError):
            transpose([[1, 2], [3]])
        with self.assertRaises(ValueError):
            transpose([[1, 2], [3, 4], []])

    def test_later_row_longer(self):
        with self.assertRaises(ValueError):
            transpose([[1], [2, 3]])
        with self.assertRaises(ValueError):
            transpose([[1, 2], [3, 4], [5, 6, 7]])

    def test_first_row_empty(self):
        with self.assertRaises(ValueError):
            transpose([[], [1]])

    def test_middle_row_longer(self):
        with self.assertRaises(ValueError):
            transpose([[1], [2, 3], [4]])

    def test_tuple_rows(self):
        result = transpose([(1, 2), (3, 4)])
        self.assertEqual(result, [[1, 3], [2, 4]])
        for row in result:
            self.assertIs(type(row), list)
        self.assertEqual(transpose([(1, 2, 3), [4, 5, 6]]), [[1, 4], [2, 5], [3, 6]])

    def test_ragged_tuple_rows(self):
        with self.assertRaises(ValueError):
            transpose([(1, 2), (3,)])

    def test_cells_of_any_type(self):
        self.assertEqual(transpose([["a", [1]], [None, 2.5]]), [["a", None], [[1], 2.5]])
        self.assertEqual(transpose([["ab", "cd"]]), [["ab"], ["cd"]])

    def test_result_is_lists(self):
        result = transpose([[1, 2], [3, 4]])
        self.assertIs(type(result), list)
        for row in result:
            self.assertIs(type(row), list)

    def test_input_is_not_changed(self):
        rows = [[1, 2, 3], [4, 5, 6]]
        result = transpose(rows)
        self.assertEqual(rows, [[1, 2, 3], [4, 5, 6]])
        result[0].append(9)
        result.append([0])
        self.assertEqual(rows, [[1, 2, 3], [4, 5, 6]])

    def test_single_row_result_is_new(self):
        rows = [[7]]
        result = transpose(rows)
        result[0][0] = 8
        self.assertEqual(rows, [[7]])


if __name__ == "__main__":
    unittest.main()
