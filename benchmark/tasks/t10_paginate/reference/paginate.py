"""Page arithmetic for list pages."""


def page_count(total_items, per_page):
    """Number of pages needed for the items. Always at least 1."""
    if per_page < 1 or total_items < 0:
        raise ValueError("per_page must be at least 1 and total_items at least 0")
    return max(1, -(-total_items // per_page))


def page_slice(total_items, per_page, page):
    """(start, end) indexes of the items on a page. Pages are numbered from 1."""
    if page < 1 or page > page_count(total_items, per_page):
        raise ValueError("no such page")
    start = (page - 1) * per_page
    return start, min(start + per_page, total_items)


def page_window(total_items, per_page, page, size=5):
    """Page numbers to show in the pager, centred on the current page."""
    pages = page_count(total_items, per_page)
    if page < 1 or page > pages or size < 1:
        raise ValueError("no such page, or a window size below 1")
    length = min(size, pages)
    first = page - (length - 1) // 2
    first = max(1, min(first, pages - length + 1))
    return list(range(first, first + length))
