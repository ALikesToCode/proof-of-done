import heapq


class TaskQueue:
    """A priority queue whose entries are addressed by ticket. See TASK.md."""

    def __init__(self):
        self._heap = []
        self._waiting = {}
        self._last_ticket = 0

    def push(self, item, priority=0):
        self._last_ticket += 1
        ticket = self._last_ticket
        self._waiting[ticket] = (priority, item)
        heapq.heappush(self._heap, (-priority, ticket))
        return ticket

    def _front(self):
        """The ticket that comes out next, after dropping heap entries that no longer hold."""
        while self._heap:
            negated, ticket = self._heap[0]
            entry = self._waiting.get(ticket)
            if entry is not None and entry[0] == -negated:
                return ticket
            heapq.heappop(self._heap)
        raise IndexError("the queue is empty")

    def peek(self):
        return self._waiting[self._front()][1]

    def pop(self):
        ticket = self._front()
        heapq.heappop(self._heap)
        return self._waiting.pop(ticket)[1]

    def __len__(self):
        return len(self._waiting)

    def cancel(self, ticket):
        return self._waiting.pop(ticket, None) is not None

    def reprioritize(self, ticket, priority):
        _, item = self._waiting[ticket]
        self._waiting[ticket] = (priority, item)
        heapq.heappush(self._heap, (-priority, ticket))
