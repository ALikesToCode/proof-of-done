# Integer ranges

Implement three functions in `ranges.py`. A range is a tuple `(start, end)` of two `int`s and stands for every integer from `start` to `end`, **both included**. `(3, 3)` holds one integer. `(5, 2)` is not a range.

## Functions

1. `merge(ranges)` returns the smallest list of ranges that holds the same integers, sorted by `start`. Ranges that overlap are joined, and so are ranges that sit next to each other with no integer between them: `(1, 2)` and `(3, 4)` become `(1, 4)`. `(1, 2)` and `(4, 5)` stay apart, because 3 is in neither.
2. `subtract(ranges, holes)` returns the integers that are in `ranges` and not in `holes`, as a merged list in the form `merge` returns. `subtract([(1, 10)], [(4, 5)])` is `[(1, 3), (6, 10)]`.
3. `count(ranges)` returns how many distinct integers the ranges hold. `count([(1, 3), (2, 5)])` is 5.

## Rules for all three

- Every argument is a list of ranges in any order. It may be empty, and the result is then `[]` or `0`.
- A range with `start > end` raises `ValueError`. That holds for `holes` as well.
- The arguments are not changed.
- The result of `merge` and `subtract` is a `list` of `tuple`s.

Run the provided tests with `python3 -m unittest test_visible -v`.
