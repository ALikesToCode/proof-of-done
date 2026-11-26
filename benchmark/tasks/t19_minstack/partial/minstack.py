class MinStack:
    def __init__(self):
        self._items = []
        self._mins = []

    def push(self, value):
        self._items.append(value)
        if not self._mins or value < self._mins[-1]:
            self._mins.append(value)

    def pop(self):
        value = self._items.pop()
        if self._mins and value == self._mins[-1]:
            self._mins.pop()
        return value

    def top(self):
        return self._items[-1]

    def get_min(self):
        return self._mins[-1] if self._mins else None

    def __len__(self):
        return len(self._items)
