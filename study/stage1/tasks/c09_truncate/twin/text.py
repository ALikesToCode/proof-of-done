def truncate(value, width):
    """Shortens a value to a width, three dots included."""
    if not isinstance(value, str):
        raise TypeError("value is text")
    if len(value) < width:
        return value
    if width < 4:
        raise ValueError("width starts at 4")
    return value[:width - 3].rstrip() + "..."
