# Fix and extend pagination

`paginate.py` backs the list pages of the site. Support reported this:

> With 20 items and 10 per page, the site shows a third, empty page.

## What to change

1. `page_count(total_items, per_page)` is the number of pages needed: 20 items at 10 per page is 2 pages, 21 items is 3. Zero items is 1 page, because the site always shows one page.
2. `page_slice(total_items, per_page, page)` returns `(start, end)`, the indexes of the first item on the page and one past the last, so that `items[start:end]` is the page. Pages are numbered from 1. The last page may be short. A page below 1 or above `page_count` raises `ValueError`.
3. `page_window(total_items, per_page, page, size=5)` returns the list of page numbers to show in the pager. Its rules:
   - It lists `size` consecutive page numbers, or all pages when there are fewer than `size`.
   - The current page is in the middle when it can be. With an even `size` the extra page goes after the current one: `size=4` around page 5 of 10 is `[4, 5, 6, 7]`.
   - Near the first or the last page the window is shifted to stay inside 1 to `page_count`, and it keeps its full length: page 10 of 10 with `size=5` is `[6, 7, 8, 9, 10]`.
   - A page below 1 or above `page_count`, and a `size` below 1, raise `ValueError`.
4. In all three functions `per_page` below 1 and `total_items` below 0 raise `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
