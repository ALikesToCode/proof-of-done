import unittest

from paginate import page_count, page_slice, page_window


class HiddenTests(unittest.TestCase):
    def test_visible_cases(self):
        self.assertEqual(page_count(20, 10), 2)
        self.assertEqual(page_count(21, 10), 3)
        self.assertEqual(page_slice(25, 10, 1), (0, 10))
        self.assertEqual(page_window(100, 10, 5), [3, 4, 5, 6, 7])
        self.assertEqual(page_window(100, 10, 1), [1, 2, 3, 4, 5])

    def test_page_count(self):
        self.assertEqual(page_count(0, 10), 1)
        self.assertEqual(page_count(1, 10), 1)
        self.assertEqual(page_count(10, 10), 1)
        self.assertEqual(page_count(11, 10), 2)
        self.assertEqual(page_count(5, 1), 5)
        self.assertEqual(page_count(99, 100), 1)

    def test_slice_last_page_is_short(self):
        self.assertEqual(page_slice(25, 10, 3), (20, 25))
        self.assertEqual(page_slice(25, 10, 2), (10, 20))
        self.assertEqual(page_slice(20, 10, 2), (10, 20))
        self.assertEqual(page_slice(1, 10, 1), (0, 1))

    def test_slice_of_nothing(self):
        self.assertEqual(page_slice(0, 10, 1), (0, 0))

    def test_slice_bad_page(self):
        for page in (0, -1, 3):
            with self.assertRaises(ValueError):
                page_slice(20, 10, page)
        with self.assertRaises(ValueError):
            page_slice(0, 10, 2)

    def test_slices_cover_everything_once(self):
        items = list(range(47))
        seen = []
        for page in range(1, page_count(47, 6) + 1):
            start, end = page_slice(47, 6, page)
            seen.extend(items[start:end])
            self.assertLessEqual(end, 47)
        self.assertEqual(seen, items)

    def test_window_at_the_end_keeps_its_length(self):
        self.assertEqual(page_window(100, 10, 10), [6, 7, 8, 9, 10])
        self.assertEqual(page_window(100, 10, 9), [6, 7, 8, 9, 10])
        self.assertEqual(page_window(100, 10, 8), [6, 7, 8, 9, 10])
        self.assertEqual(page_window(100, 10, 7), [5, 6, 7, 8, 9])

    def test_window_near_the_start(self):
        self.assertEqual(page_window(100, 10, 2), [1, 2, 3, 4, 5])
        self.assertEqual(page_window(100, 10, 3), [1, 2, 3, 4, 5])
        self.assertEqual(page_window(100, 10, 4), [2, 3, 4, 5, 6])

    def test_window_with_few_pages(self):
        self.assertEqual(page_window(30, 10, 2), [1, 2, 3])
        self.assertEqual(page_window(30, 10, 3), [1, 2, 3])
        self.assertEqual(page_window(0, 10, 1), [1])
        self.assertEqual(page_window(50, 10, 5), [1, 2, 3, 4, 5])

    def test_window_even_size(self):
        self.assertEqual(page_window(100, 10, 5, size=4), [4, 5, 6, 7])
        self.assertEqual(page_window(100, 10, 1, size=4), [1, 2, 3, 4])
        self.assertEqual(page_window(100, 10, 10, size=4), [7, 8, 9, 10])
        self.assertEqual(page_window(100, 10, 5, size=2), [5, 6])
        self.assertEqual(page_window(100, 10, 10, size=2), [9, 10])

    def test_window_other_sizes(self):
        self.assertEqual(page_window(100, 10, 5, size=1), [5])
        self.assertEqual(page_window(100, 10, 5, size=3), [4, 5, 6])
        self.assertEqual(page_window(100, 10, 5, size=20), list(range(1, 11)))

    def test_window_uses_fixed_page_count(self):
        self.assertEqual(page_window(20, 10, 2), [1, 2])
        self.assertEqual(page_window(60, 10, 6), [2, 3, 4, 5, 6])

    def test_window_bad_arguments(self):
        for page in (0, 11, -2):
            with self.assertRaises(ValueError):
                page_window(100, 10, page)
        for size in (0, -1):
            with self.assertRaises(ValueError):
                page_window(100, 10, 5, size=size)

    def test_bad_totals_and_per_page(self):
        for call in (
            lambda: page_count(10, 0),
            lambda: page_count(10, -5),
            lambda: page_count(-1, 10),
            lambda: page_slice(10, 0, 1),
            lambda: page_slice(-1, 10, 1),
            lambda: page_window(10, 0, 1),
            lambda: page_window(-1, 10, 1),
        ):
            with self.assertRaises(ValueError):
                call()


if __name__ == "__main__":
    unittest.main()
