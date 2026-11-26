def compare(a, b):
    """Returns -1, 0 or 1 as version a is older than, equal to or newer than b."""
    if a == b:
        return 0
    return -1 if a.split(".") < b.split(".") else 1
