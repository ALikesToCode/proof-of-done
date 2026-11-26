"""Binary searches on an ascending list that may hold duplicates."""


def _lower(items, value):
    """Index of the first item that is >= value."""
    low, high = 0, len(items)
    while low < high:
        middle = (low + high) // 2
        if items[middle] < value:
            low = middle + 1
        else:
            high = middle
    return low


def _upper(items, value):
    """Index just past the last item that is <= value."""
    low, high = 0, len(items)
    while low < high:
        middle = (low + high) // 2
        if items[middle] <= value:
            low = middle + 1
        else:
            high = middle
    return low


def find_first(items, value):
    index = _lower(items, value)
    return index if index < len(items) and items[index] == value else -1


def find_last(items, value):
    index = _upper(items, value) - 1
    return index if index >= 0 and items[index] == value else -1


def count_of(items, value):
    return _upper(items, value) - _lower(items, value)


def insert_position(items, value):
    return _upper(items, value)
