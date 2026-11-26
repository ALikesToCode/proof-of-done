def truncate(value, width):
    """Shortens a value to a width and marks the cut with three dots."""
    if len(value) < width:
        return value
    return value[:width] + "..."
