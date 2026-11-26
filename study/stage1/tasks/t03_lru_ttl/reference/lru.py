"""A least-recently-used cache with optional expiry."""
import time
from collections import OrderedDict

USE_DEFAULT = object()


class LRUCache:
    def __init__(self, capacity, ttl=None, clock=time.monotonic):
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        self._check_ttl(ttl)
        self.capacity = capacity
        self.ttl = ttl
        self._clock = clock
        self._items = OrderedDict()  # key -> (value, stored_at, ttl)

    @staticmethod
    def _check_ttl(ttl):
        if ttl is not None and ttl <= 0:
            raise ValueError("ttl must be greater than 0")

    def _purge(self):
        now = self._clock()
        for key in [k for k, (_, stored_at, ttl) in self._items.items() if ttl is not None and now - stored_at >= ttl]:
            del self._items[key]

    def get(self, key, default=None):
        """Return the value and mark the entry as most recently used."""
        self._purge()
        if key not in self._items:
            return default
        self._items.move_to_end(key)
        return self._items[key][0]

    def peek(self, key, default=None):
        """Return the value without touching the order."""
        self._purge()
        return self._items[key][0] if key in self._items else default

    def put(self, key, value, ttl=USE_DEFAULT):
        if ttl is USE_DEFAULT:
            ttl = self.ttl
        self._check_ttl(ttl)
        self._purge()
        if key in self._items:
            del self._items[key]
        elif len(self._items) >= self.capacity:
            self._items.popitem(last=False)
        self._items[key] = (value, self._clock(), ttl)

    def keys(self):
        """Live keys from least to most recently used."""
        self._purge()
        return list(self._items)

    def __contains__(self, key):
        self._purge()
        return key in self._items

    def __len__(self):
        self._purge()
        return len(self._items)
