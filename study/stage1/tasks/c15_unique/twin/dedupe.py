def unique(items, key=None):
    """Removes duplicates and keeps the first of each in its place."""
    if key is None:
        return list(dict.fromkeys(items))
    seen = set()
    out = []
    for item in items:
        marker = key(item)
        if marker not in seen:
            seen.add(marker)
            out.append(item)
    return out
