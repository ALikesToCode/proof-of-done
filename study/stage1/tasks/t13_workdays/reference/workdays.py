from datetime import timedelta

_DAY = timedelta(days=1)


def _works(day, holidays):
    return day.weekday() < 5 and day not in holidays


def add_workdays(start, days, holidays=()):
    """The date `days` working days from `start`. See TASK.md."""
    if isinstance(days, bool) or not isinstance(days, int):
        raise TypeError("days must be an int")
    holidays = set(holidays)
    current = start
    if days == 0:
        while not _works(current, holidays):
            current += _DAY
        return current
    step = _DAY if days > 0 else -_DAY
    left = abs(days)
    while left > 0:
        current += step
        if _works(current, holidays):
            left -= 1
    return current


def count_workdays(first, last, holidays=()):
    """Working days from `first` to `last`, both included. See TASK.md."""
    if first > last:
        return -count_workdays(last, first, holidays)
    holidays = set(holidays)
    total = 0
    current = first
    while current <= last:
        total += _works(current, holidays)
        current += _DAY
    return total
