# Count working days

Delivery estimates promise delivery on a Sunday, because `working_days_between` in `workdays.py` counts every calendar day. Make it skip Saturdays and Sundays, and let callers pass public holidays. Dates are `datetime.date` objects.

## Rules

1. `working_days_between(start, end, holidays=())` returns an `int`: the number of working days from `start` up to but not including `end`. From Monday 2 Nov 2026 to Thursday 5 Nov 2026 it is 3.
2. A working day is a day from Monday to Friday that is not in `holidays`. Saturdays and Sundays are never counted: Friday 6 Nov 2026 to Monday 9 Nov 2026 is 1, and Monday 2 Nov 2026 to Monday 9 Nov 2026 is 5.
3. `start` is counted when it is a working day, and `end` is never counted. When `start` and `end` are the same day the result is 0.
4. When `end` is before `start` the function raises `ValueError`.
5. `holidays` is any iterable of dates, such as a list, a tuple, a set or a generator. Each holiday that is a Monday to Friday inside the range lowers the count by one: Monday 2 Nov 2026 to Monday 9 Nov 2026 with the holiday Wednesday 4 Nov 2026 is 4.
6. A holiday on a Saturday or Sunday changes nothing, and a date that appears more than once in `holidays` is counted once.
7. A holiday outside the range changes nothing. A holiday on `end` itself is outside the range, and a holiday on `start` is inside it.

Run the provided tests with `python3 -m unittest test_visible -v`.
