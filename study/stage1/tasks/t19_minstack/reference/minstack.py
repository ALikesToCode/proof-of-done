class MinStack:
    """A stack that reports its smallest value."""

    def __init__(self):
        self._items = []  # (value, smallest value at or below this entry)

    def push(self, value):
        smallest = value if not self._items or value < self._items[-1][1] else self._items[-1][1]
        self._items.append((value, smallest))

    def pop(self):
        return self._items.pop()[0]

    def top(self):
        return self._items[-1][0]

    def get_min(self):
        if not self._items:
            raise ValueError("the stack is empty")
        return self._items[-1][1]

    def __len__(self):
        return len(self._items)
