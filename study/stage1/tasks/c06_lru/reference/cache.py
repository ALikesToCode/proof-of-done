class LRUCache:
    """Keeps the most recently used entries, up to a capacity."""

    def __init__(self, capacity):
        if capacity < 1:
            raise ValueError("capacity starts at 1")
        self.capacity = capacity
        self._data = {}

    def get(self, key, default=None):
        if key not in self._data:
            return default
        value = self._data.pop(key)
        self._data[key] = value
        return value

    def put(self, key, value):
        if key in self._data:
            del self._data[key]
        elif len(self._data) >= self.capacity:
            oldest = next(iter(self._data))
            del self._data[oldest]
        self._data[key] = value

    def keys(self):
        """The keys from the least recently used to the most recently used."""
        return list(self._data)

    def __contains__(self, key):
        return key in self._data

    def __len__(self):
        return len(self._data)
