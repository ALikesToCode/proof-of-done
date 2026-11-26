class TokenBucket:
    """Allows a call while tokens are left."""

    def __init__(self, capacity, per_second):
        self.capacity = capacity
        self.per_second = per_second
        self.tokens = capacity

    def allow(self, now):
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
