def paginate(items, page, size):
    """Returns the items of one page. Pages start at 1."""
    if page < 1:
        raise ValueError("pages start at 1")
    start = (page - 1) * size
    return items[start:start + size]
