import calendar
from datetime import date


def add_months(day, months):
    """The date `months` months after `day`, clamped to the end of the month. See TASK.md."""
    if isinstance(months, bool) or not isinstance(months, int):
        raise TypeError("months must be an int")
    index = day.year * 12 + (day.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    if not 1 <= year <= 9999:
        raise ValueError("the result is outside the years 1 to 9999")
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def months_between(start, end):
    """Whole months from `start` to `end`. See TASK.md."""
    if start > end:
        return -months_between(end, start)
    count = (end.year - start.year) * 12 + (end.month - start.month)
    while count > 0 and add_months(start, count) > end:
        count -= 1
    return count
