def _check(value, name):
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise ValueError(f"{name} must be an int of at least 1")


def chunk(items, size):
    _check(size, "size")
    return [list(items[start:start + size]) for start in range(0, len(items), size)]


def sliding(items, size, step=1):
    _check(size, "size")
    _check(step, "step")
    return [list(items[start:start + size]) for start in range(0, len(items) - size + 1, step)]
