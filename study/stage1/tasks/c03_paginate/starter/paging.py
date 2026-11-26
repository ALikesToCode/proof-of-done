def paginate(items, page, size):
    """Returns the items of one page. Pages start at 1."""
    start = (page - 1) * size
    end = min(start + size, len(items) - 1)
    return items[start:end]
