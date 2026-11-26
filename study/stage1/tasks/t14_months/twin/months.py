import calendar
from datetime import date


def add_months(day, months):
    index = day.month - 1 + months
    year = day.year + index // 12
    month = index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def months_between(start, end):
    count = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        count -= 1
    return count
