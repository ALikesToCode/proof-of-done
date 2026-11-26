from datetime import date, timedelta


def working_days_between(start: date, end: date, holidays=()) -> int:
    """Counts the working days from start up to, but not including, end. See TASK.md."""
    if end < start:
        raise ValueError("end is before start")
    days_off = set(holidays)
    count = 0
    day = start
    while day < end:
        if day.weekday() < 5 and day not in days_off:
            count += 1
        day += timedelta(days=1)
    return count
