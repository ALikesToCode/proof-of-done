"""Date ranges."""
from datetime import timedelta


def _check(step):
    if isinstance(step, bool) or not isinstance(step, int) or step < 1:
        raise ValueError("step must be an int of at least 1")


def count_dates(start, end, step=1):
    """How many dates `dates_between` returns."""
    _check(step)
    return abs((end - start).days) // step + 1


def dates_between(start, end, step=1):
    """The dates from `start` to `end`, both included, every `step` days. See TASK.md."""
    _check(step)
    stride = timedelta(days=step if end >= start else -step)
    return [start + stride * index for index in range(count_dates(start, end, step))]
