# Fix the date range

`daterange.py` lists the dates of a range. A user reported:

> `dates_between(date(2026, 3, 1), date(2026, 3, 3))` gives the 1st and the 2nd. The 3rd is missing.

## What must hold

1. `dates_between(start, end, step=1)` returns a `list` of `datetime.date`: `start`, then every `step`-th day after it, up to and **including** `end` when a step lands on it. A step that would pass `end` stops the list.
2. When `start` is after `end`, the list runs backward by the same rule: from `start` down to `end`. `step` is still given as a positive number.
3. `start == end` gives one date.
4. `step` must be an `int` of at least 1, otherwise `ValueError`.
5. `count_dates(start, end, step=1)` is `len(dates_between(start, end, step))`, with the same errors. It must not build the list: it is used for ranges of millions of days.

Run the provided tests with `python3 -m unittest test_visible -v`.
