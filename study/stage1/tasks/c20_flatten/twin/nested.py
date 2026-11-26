def _open_one_level(items):
    out = []
    for item in items:
        if isinstance(item, list):
            out.extend(item)
        else:
            out.append(item)
    return out


def flatten(items, depth=None):
    """Flattens nested lists, completely or by a number of levels."""
    if depth is not None and depth < 0:
        raise ValueError("depth cannot be negative")
    out = list(items)
    if not depth:
        while any(isinstance(item, list) for item in out):
            out = _open_one_level(out)
        return out
    for _ in range(depth):
        out = _open_one_level(out)
    return out
