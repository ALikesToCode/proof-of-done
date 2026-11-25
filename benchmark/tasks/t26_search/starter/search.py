"""Binary searches on an ascending list that may hold duplicates."""


def find_first(items, value):
    low, high = 0, len(items) - 1
    while low < high:
        middle = (low + high) // 2
        if items[middle] < value:
            low = middle + 1
        else:
            high = middle
    return low if items and items[low] == value else -1


def _upper(items, value):
    """Index just past the last item that is <= value."""
    low, high = 0, len(items) - 1
    while low < high:
        middle = (low + high) // 2
        if items[middle] <= value:
            low = middle + 1
        else:
            high = middle
    return low


def find_last(items, value):
    index = _upper(items, value) - 1
    return index if index >= 0 and items[index] == value else -1


def count_of(items, value):
    first = find_first(items, value)
    return 0 if first < 0 else _upper(items, value) - first


def insert_position(items, value):
    return _upper(items, value)
