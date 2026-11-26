# Merge bookings into blocks

The calendar draws 9 to 10 and 10 to 11 as two blocks, and gets confused when bookings arrive out of order. Fix `merge(intervals)` in `intervals.py`. It takes a list of `(start, end)` pairs of numbers and returns the merged blocks.

## Rules

1. The result is a new list of `(start, end)` tuples, sorted by start. No two intervals in it overlap or touch.
2. Intervals that overlap or touch are joined into one: `merge([(9, 10), (10, 11)])` is `[(9, 11)]` and `merge([(1, 3), (2, 5)])` is `[(1, 5)]`. Intervals with a gap between them stay apart: `merge([(1, 2), (4, 5)])` is `[(1, 2), (4, 5)]`.
3. The order of the input does not matter: `merge([(5, 7), (1, 3), (3, 4)])` is `[(1, 4), (5, 7)]`.
4. An interval that lies inside another disappears into it, and the outer interval keeps its end: `merge([(1, 10), (2, 3)])` is `[(1, 10)]`.
5. An interval whose start equals its end is allowed. It is kept on its own unless it touches or lies inside another: `merge([(5, 5)])` is `[(5, 5)]` and `merge([(1, 3), (3, 3)])` is `[(1, 3)]`.
6. An interval whose end is before its start raises `ValueError`, wherever it stands in the list.
7. The input list is not changed, and its pairs may be tuples or lists: `merge([[1, 2], [2, 3]])` is `[(1, 3)]`.
8. The empty list gives the empty list.

Run the provided tests with `python3 -m unittest test_visible -v`.
