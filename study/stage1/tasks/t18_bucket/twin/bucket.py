import time


class TokenBucket:
    def __init__(self, rate, capacity, clock=time.monotonic):
        if rate <= 0 or capacity <= 0:
            raise ValueError("rate and capacity must be greater than 0")
        self.rate = float(rate)
        self.capacity = float(capacity)
        self._clock = clock
        self._tokens = self.capacity
        self._at = clock()

    def _refill(self):
        now = self._clock()
        self._tokens = min(self.capacity, self._tokens + float(now - self._at) * self.rate)
        self._at = now

    def available(self):
        self._refill()
        return self._tokens

    def take(self, cost=1):
        self._refill()
        if self._tokens < cost:
            return False
        self._tokens -= cost
        return True

    def wait_time(self, cost=1):
        self._refill()
        return max(0.0, (cost - self._tokens) / self.rate)
