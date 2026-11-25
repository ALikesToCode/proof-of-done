"""Date ranges."""
from datetime import timedelta


def dates_between(start, end, step=1):
    """The dates from `start` to `end`, every `step` days."""
    days = (end - start).days
    return [start + timedelta(days=offset) for offset in range(0, days, step)]


def count_dates(start, end, step=1):
    """How many dates `dates_between` returns."""
    return (end - start).days // step
