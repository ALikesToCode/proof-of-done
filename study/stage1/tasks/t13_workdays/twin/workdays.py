from datetime import timedelta


def add_workdays(start, days, holidays=()):
    current = start
    while current.weekday() >= 5 or current in holidays:
        current += timedelta(days=1)
    left = days
    while left > 0:
        current += timedelta(days=1)
        if current.weekday() < 5 and current not in holidays:
            left -= 1
    return current


def count_workdays(first, last, holidays=()):
    total = 0
    current = first
    while current <= last:
        if current.weekday() < 5 and current not in holidays:
            total += 1
        current += timedelta(days=1)
    return total
