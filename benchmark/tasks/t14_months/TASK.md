# Month arithmetic

Implement two functions in `months.py`. Dates are `datetime.date` objects.

## `add_months(day, months)` returns a `date`

1. The result is the same day of the month, `months` months later. `months` may be negative or zero.
2. When the target month has no such day, the result is the last day of the target month: 31 Jan 2026 plus 1 month is 28 Feb 2026, and 31 Jan 2028 plus 1 month is 29 Feb 2028.
3. Clamping is not remembered. `add_months(add_months(date(2026, 1, 31), 1), 1)` is 28 Mar 2026.
4. `months` must be an `int` and not a `bool`, otherwise `TypeError`. A result outside the years 1 to 9999 raises `ValueError`.

## `months_between(start, end)` returns an `int`

5. It is the largest `n >= 0` such that `add_months(start, n) <= end`, when `start <= end`.
6. When `start > end`, it is `-months_between(end, start)`.

So `months_between(date(2026, 1, 31), date(2026, 2, 28))` is 1, and `months_between(date(2026, 1, 31), date(2026, 2, 27))` is 0.

Run the provided tests with `python3 -m unittest test_visible -v`.
