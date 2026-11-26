class MinStack:
    """A stack that reports its smallest value."""

    def __init__(self):
        self._items = []
        self._min = None

    def push(self, value):
        self._items.append(value)
        if self._min is None or value < self._min:
            self._min = value

    def pop(self):
        return self._items.pop()

    def top(self):
        return self._items[-1]

    def get_min(self):
        return self._min

    def __len__(self):
        return len(self._items)
