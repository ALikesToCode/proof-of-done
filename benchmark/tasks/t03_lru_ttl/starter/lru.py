"""A least-recently-used cache."""
import time
from collections import OrderedDict


class LRUCache:
    def __init__(self, capacity, clock=time.monotonic):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self.capacity = capacity
        self._clock = clock
        self._items = OrderedDict()

    def get(self, key, default=None):
        """Return the value and mark the entry as most recently used."""
        if key not in self._items:
            return default
        self._items.move_to_end(key)
        return self._items[key]

    def peek(self, key, default=None):
        """Return the value without touching the order."""
        return self._items.get(key, default)

    def put(self, key, value):
        if key in self._items:
            self._items.move_to_end(key)
        elif len(self._items) >= self.capacity:
            self._items.popitem(last=False)
        self._items[key] = value

    def keys(self):
        """Keys from least to most recently used."""
        return list(self._items)

    def __contains__(self, key):
        return key in self._items

    def __len__(self):
        return len(self._items)
