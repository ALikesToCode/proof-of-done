def paginate(items, page, size):
    """Returns the items of one page as a list. Pages start at 1."""
    if page < 1 or size < 1:
        raise ValueError("page and size start at 1")
    start = (page - 1) * size
    return list(items[start:start + size])
