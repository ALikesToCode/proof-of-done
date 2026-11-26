class TokenBucket:
    """Allows a call while tokens are left, and refills them over time. See TASK.md."""

    def __init__(self, capacity, per_second):
        if capacity <= 0 or per_second <= 0:
            raise ValueError("capacity and per_second must be greater than 0")
        self.capacity = capacity
        self.per_second = per_second
        self.tokens = capacity
        self.last = None

    def allow(self, now):
        if self.last is None:
            self.last = now
        elif now > self.last:
            self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.per_second)
            self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
