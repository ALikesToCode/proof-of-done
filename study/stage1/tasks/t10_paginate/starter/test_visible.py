import unittest

from paginate import page_count, page_slice, page_window


class VisibleTests(unittest.TestCase):
    def test_reported_bug(self):
        self.assertEqual(page_count(20, 10), 2)

    def test_partial_last_page(self):
        self.assertEqual(page_count(21, 10), 3)

    def test_slice_first_page(self):
        self.assertEqual(page_slice(25, 10, 1), (0, 10))

    def test_window_in_the_middle(self):
        self.assertEqual(page_window(100, 10, 5), [3, 4, 5, 6, 7])

    def test_window_at_the_start(self):
        self.assertEqual(page_window(100, 10, 1), [1, 2, 3, 4, 5])


if __name__ == "__main__":
    unittest.main()
