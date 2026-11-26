import heapq
import itertools


class TaskQueue:
    """A priority queue whose entries are addressed by ticket. See TASK.md."""

    def __init__(self):
        self._heap = []
        self._entries = {}
        self._tickets = itertools.count(1)
        self._order = itertools.count()

    def push(self, item, priority=0):
        ticket = next(self._tickets)
        self._add(ticket, item, priority)
        return ticket

    def _add(self, ticket, item, priority):
        entry = [-priority, next(self._order), ticket, item]
        self._entries[ticket] = entry
        heapq.heappush(self._heap, entry)

    def _remove(self, ticket):
        """Take an entry out of the index and mark its heap slot as dead."""
        entry = self._entries.pop(ticket)
        entry[2] = None
        return entry[3]

    def _front(self):
        while self._heap and self._heap[0][2] is None:
            heapq.heappop(self._heap)
        if not self._heap:
            raise IndexError("the queue is empty")
        return self._heap[0]

    def peek(self):
        return self._front()[3]

    def pop(self):
        entry = self._front()
        heapq.heappop(self._heap)
        del self._entries[entry[2]]
        return entry[3]

    def __len__(self):
        return len(self._entries)

    def cancel(self, ticket):
        if ticket not in self._entries:
            return False
        self._remove(ticket)
        return True

    def reprioritize(self, ticket, priority):
        item = self._remove(ticket)
        self._add(ticket, item, priority)
