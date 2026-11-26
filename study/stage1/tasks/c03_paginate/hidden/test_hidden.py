import unittest

from paging import paginate

SEVEN = [1, 2, 3, 4, 5, 6, 7]


class HiddenTests(unittest.TestCase):
    def test_first_page(self):
        self.assertEqual(paginate(SEVEN, 1, 3), [1, 2, 3])

    def test_second_page(self):
        self.assertEqual(paginate(SEVEN, 2, 3), [4, 5, 6])

    def test_last_page_is_complete(self):
        self.assertEqual(paginate([1, 2, 3, 4, 5], 2, 3), [4, 5])
        self.assertEqual(paginate(SEVEN, 3, 3), [7])

    def test_exact_fit(self):
        self.assertEqual(paginate([1, 2, 3, 4], 2, 2), [3, 4])
        self.assertEqual(paginate([1, 2, 3], 1, 3), [1, 2, 3])

    def test_size_one(self):
        self.assertEqual(paginate([1, 2, 3], 3, 1), [3])

    def test_past_the_end(self):
        self.assertEqual(paginate([1, 2, 3], 5, 3), [])
        self.assertEqual(paginate([1, 2, 3, 4], 3, 2), [])

    def test_empty_items(self):
        self.assertEqual(paginate([], 1, 3), [])
        self.assertEqual(paginate([], 4, 3), [])

    def test_page_below_one(self):
        for page in (0, -1):
            with self.assertRaises(ValueError):
                paginate([1, 2, 3], page, 3)

    def test_size_zero(self):
        with self.assertRaises(ValueError):
            paginate([1, 2, 3], 1, 0)

    def test_negative_size(self):
        for page, size in ((1, -1), (2, -3)):
            with self.assertRaises(ValueError):
                paginate([1, 2, 3], page, size)

    def test_bad_page_on_empty_items(self):
        with self.assertRaises(ValueError):
            paginate([], 0, 3)

    def test_bad_size_on_empty_items(self):
        with self.assertRaises(ValueError):
            paginate([], 1, 0)

    def test_tuple_page_is_a_list(self):
        page = paginate((1, 2, 3), 1, 2)
        self.assertEqual(page, [1, 2])
        self.assertIs(type(page), list)
        self.assertEqual(paginate((1, 2, 3, 4, 5), 2, 3), [4, 5])

    def test_tuple_past_the_end_is_a_list(self):
        self.assertEqual(paginate((1, 2, 3), 5, 3), [])

    def test_result_is_a_new_list(self):
        items = [1, 2, 3]
        page = paginate(items, 1, 3)
        self.assertEqual(page, [1, 2, 3])
        self.assertIsNot(page, items)
        page.append(9)
        self.assertEqual(items, [1, 2, 3])

    def test_items_not_changed(self):
        items = [1, 2, 3, 4, 5]
        paginate(items, 2, 2)
        self.assertEqual(items, [1, 2, 3, 4, 5])

    def test_size_larger_than_items(self):
        self.assertEqual(paginate([1, 2], 1, 10), [1, 2])
        self.assertEqual(paginate([1, 2], 2, 10), [])


if __name__ == "__main__":
    unittest.main()
