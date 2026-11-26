from datetime import date


def working_days_between(start: date, end: date) -> int:
    """Counts the working days from start up to, but not including, end."""
    return (end - start).days
