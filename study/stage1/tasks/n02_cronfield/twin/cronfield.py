def _expand_part(part, low, high):
    base, slash, step_text = part.partition("/")
    step = int(step_text) if slash else 1
    if step < 1:
        raise ValueError(f"the step must be at least 1: {part!r}")
    if base == "*":
        start, end = low, high
    elif "-" in base:
        first, last = base.split("-")
        start, end = int(first), int(last)
    else:
        start = int(base)
        end = high if slash else start
    for number in (start, end):
        if not low <= number <= high:
            raise ValueError(f"{part!r} does not fit {low} to {high}")
    return range(start, end + 1, step)


def expand_field(field, low, high):
    """The sorted values from `low` to `high` that one cron field matches. See TASK.md."""
    values = set()
    for part in field.split(","):
        values.update(_expand_part(part, low, high))
    return sorted(values)
