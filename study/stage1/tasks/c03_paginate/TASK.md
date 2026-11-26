# Fix the last page

The list endpoint drops the final item on the last page, and page 0 quietly returns the wrong rows. Fix `paginate(items, page, size)` in `paging.py`. It returns the items of one page.

## Rules

1. Pages start at 1 and hold `size` items each, in the order of `items`: with the items 1 to 7 and size 3, page 1 is `[1, 2, 3]` and page 2 is `[4, 5, 6]`.
2. The last page holds every item that is left, however few: page 2 of `[1, 2, 3, 4, 5]` with size 3 is `[4, 5]`, and page 3 of the items 1 to 7 with size 3 is `[7]`.
3. A page past the end gives an empty list: page 5 of three items with size 3 is `[]`. An empty `items` gives `[]` for every page from 1 up.
4. `page` below 1 raises `ValueError`, and so does `size` below 1. Both are checked before `items` is looked at, so `paginate([], 0, 3)` raises too.
5. `items` may be a list or a tuple. The result is always a new `list`, and `items` itself is not changed: `paginate((1, 2, 3), 1, 2)` is `[1, 2]`.
6. A `size` larger than the number of items puts all of them on page 1: `paginate([1, 2], 1, 10)` is `[1, 2]`.

Run the provided tests with `python3 -m unittest test_visible -v`.
