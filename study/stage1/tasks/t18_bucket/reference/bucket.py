import time
from fractions import Fraction


def _exact(value):
    return value if isinstance(value, (int, Fraction)) else Fraction(value)


class TokenBucket:
    """A token bucket rate limiter. See TASK.md."""

    def __init__(self, rate, capacity, clock=time.monotonic):
        if rate <= 0 or capacity <= 0:
            raise ValueError("rate and capacity must be greater than 0")
        self.rate = _exact(rate)
        self.capacity = _exact(capacity)
        self._clock = clock
        self._tokens = self.capacity
        self._at = _exact(clock())

    def _refill(self):
        now = _exact(self._clock())
        if now > self._at:
            self._tokens = min(self.capacity, self._tokens + (now - self._at) * self.rate)
        self._at = now

    def _check(self, cost):
        if cost <= 0 or cost > self.capacity:
            raise ValueError("cost must be greater than 0 and at most the capacity")
        return _exact(cost)

    def available(self):
        self._refill()
        return self._tokens

    def take(self, cost=1):
        cost = self._check(cost)
        self._refill()
        if self._tokens < cost:
            return False
        self._tokens -= cost
        return True

    def wait_time(self, cost=1):
        cost = self._check(cost)
        self._refill()
        if self._tokens >= cost:
            return 0
        return (cost - self._tokens) / self.rate
