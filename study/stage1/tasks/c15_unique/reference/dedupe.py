def unique(items, key=None):
    """Removes duplicates and keeps the first of each in its place. See TASK.md."""
    hashed = set()
    others = []
    out = []
    for item in items:
        marker = item if key is None else key(item)
        try:
            known = marker in hashed
            hashable = True
        except TypeError:
            known = any(marker == old for old in hashed)
            hashable = False
        if known or any(marker == old for old in others):
            continue
        if hashable:
            hashed.add(marker)
        else:
            others.append(marker)
        out.append(item)
    return out
