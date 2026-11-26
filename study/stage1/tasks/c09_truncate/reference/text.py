def truncate(value, width):
    """Shortens a value to a width, three dots included."""
    if width < 4:
        raise ValueError("width starts at 4")
    if not isinstance(value, str):
        raise TypeError("value is text")
    if len(value) <= width:
        return value
    return value[:width - 3].rstrip() + "..."
