"""Page arithmetic for list pages."""


def page_count(total_items, per_page):
    return max(1, (total_items + per_page - 1) // per_page)


def page_slice(total_items, per_page, page):
    if page < 1 or page > page_count(total_items, per_page):
        raise ValueError("no such page")
    start = (page - 1) * per_page
    return start, start + per_page


def page_window(total_items, per_page, page, size=5):
    pages = page_count(total_items, per_page)
    first = max(1, page - size // 2)
    last = min(pages, first + size - 1)
    return list(range(first, last + 1))
