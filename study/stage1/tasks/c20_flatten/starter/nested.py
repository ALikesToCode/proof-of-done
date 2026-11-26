def flatten(items):
    """Flattens nested lists into one list."""
    out = []
    for item in items:
        if isinstance(item, list):
            out.extend(flatten(item))
        else:
            out.append(item)
    return out
