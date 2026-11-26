"""Page arithmetic for list pages."""


def page_count(total_items, per_page):
    """Number of pages needed for the items."""
    return total_items // per_page + 1


def page_slice(total_items, per_page, page):
    """(start, end) indexes of the items on a page. Pages are numbered from 1."""
    if page < 1 or page > page_count(total_items, per_page):
        raise ValueError("no such page")
    start = (page - 1) * per_page
    return start, start + per_page


def page_window(total_items, per_page, page, size=5):
    """Page numbers to show in the pager, centred on the current page."""
    pages = page_count(total_items, per_page)
    first = max(1, page - size // 2)
    last = min(pages, first + size - 1)
    return list(range(first, last + 1))
