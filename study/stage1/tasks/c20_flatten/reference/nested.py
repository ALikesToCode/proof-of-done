def flatten(items, depth=None):
    """Flattens nested lists, completely or by a number of levels. See TASK.md."""
    if depth is not None and depth < 0:
        raise ValueError("depth cannot be negative")
    out = []
    for item in items:
        if isinstance(item, list) and (depth is None or depth > 0):
            out.extend(flatten(item, None if depth is None else depth - 1))
        else:
            out.append(item)
    return out
