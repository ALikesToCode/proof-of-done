import re

_PART = re.compile(r"(?:(\*)|([0-9]+)(?:-([0-9]+))?)(?:/([0-9]+))?")


def _expand_part(part, low, high):
    match = _PART.fullmatch(part)
    if match is None:
        raise ValueError(f"not a cron part: {part!r}")
    star, first, last, step = match.groups()
    if star:
        start, end = low, high
    else:
        start = int(first)
        if last is not None:
            end = int(last)
        elif step is not None:
            end = high
        else:
            end = start
        if not low <= start <= end <= high:
            raise ValueError(f"{part!r} does not fit {low} to {high}")
    step = 1 if step is None else int(step)
    if step < 1:
        raise ValueError(f"the step must be at least 1: {part!r}")
    return range(start, end + 1, step)


def expand_field(field, low, high):
    """The sorted values from `low` to `high` that one cron field matches. See TASK.md."""
    values = set()
    for part in field.split(","):
        values.update(_expand_part(part, low, high))
    return sorted(values)
