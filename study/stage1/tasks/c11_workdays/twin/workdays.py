from datetime import date, timedelta


def working_days_between(start: date, end: date, holidays=()) -> int:
    """Counts the working days from start up to, but not including, end."""
    if end < start:
        raise ValueError("end is before start")
    count = 0
    day = start
    while day < end:
        if day.weekday() < 5:
            count += 1
        day += timedelta(days=1)
    for holiday in holidays:
        if start <= holiday < end:
            count -= 1
    return count
