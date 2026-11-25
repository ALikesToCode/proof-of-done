"""Date ranges."""
from datetime import timedelta


def dates_between(start, end, step=1):
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(0, days + 1, step)]


def count_dates(start, end, step=1):
    return (end - start).days // step + 1
