"""A least-recently-used cache with expiry checked on get."""
import time
from collections import OrderedDict

USE_DEFAULT = object()


class LRUCache:
    def __init__(self, capacity, ttl=None, clock=time.monotonic):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self.capacity = capacity
        self.ttl = ttl
        self._clock = clock
        self._items = OrderedDict()

    def get(self, key, default=None):
        if key not in self._items:
            return default
        value, stored_at, ttl = self._items[key]
        if ttl is not None and self._clock() - stored_at > ttl:
            del self._items[key]
            return default
        self._items.move_to_end(key)
        return value

    def peek(self, key, default=None):
        return self._items[key][0] if key in self._items else default

    def put(self, key, value, ttl=USE_DEFAULT):
        if ttl is USE_DEFAULT:
            ttl = self.ttl
        if key in self._items:
            self._items.move_to_end(key)
        elif len(self._items) >= self.capacity:
            self._items.popitem(last=False)
        self._items[key] = (value, self._clock(), ttl)

    def keys(self):
        return list(self._items)

    def __contains__(self, key):
        return key in self._items

    def __len__(self):
        return len(self._items)
