import unittest

from paging import paginate


class VisibleTests(unittest.TestCase):
    def test_first_page(self):
        self.assertEqual(paginate([1, 2, 3, 4, 5, 6, 7], 1, 3), [1, 2, 3])

    def test_second_page(self):
        self.assertEqual(paginate([1, 2, 3, 4, 5, 6, 7], 2, 3), [4, 5, 6])

    def test_last_page_is_complete(self):
        self.assertEqual(paginate([1, 2, 3, 4, 5], 2, 3), [4, 5])

    def test_past_the_end(self):
        self.assertEqual(paginate([1, 2, 3], 5, 3), [])

    def test_rejects_page_zero(self):
        with self.assertRaises(ValueError):
            paginate([1, 2, 3], 0, 3)


if __name__ == "__main__":
    unittest.main()
