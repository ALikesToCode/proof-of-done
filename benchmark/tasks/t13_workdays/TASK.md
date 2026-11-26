# Working-day arithmetic

Implement two functions in `workdays.py`. Dates are `datetime.date` objects. A working day is a day from Monday to Friday that is not in `holidays`. `holidays` is any collection of dates and defaults to none.

## `add_workdays(start, days, holidays=())` returns a `date`

1. With `days > 0`, the result is the `days`-th working day **after** `start`. `start` itself is never counted, whether it is a working day or not. From Friday 6 Nov 2026, one working day later is Monday 9 Nov.
2. With `days < 0`, the result is the `-days`-th working day **before** `start`, by the same rule in the other direction.
3. With `days == 0`, the result is `start` when `start` is a working day. Otherwise it is the first working day after `start`.
4. `days` must be an `int`. A `bool` or any other type raises `TypeError`.

## `count_workdays(first, last, holidays=())` returns an `int`

5. It counts the working days from `first` to `last`, **both included**.
6. When `first` is after `last`, the result is the negative of `count_workdays(last, first, holidays)`.

A holiday that falls on a weekend changes nothing. `holidays` is not changed.

Run the provided tests with `python3 -m unittest test_visible -v`.
