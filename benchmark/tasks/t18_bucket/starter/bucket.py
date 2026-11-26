import time


class TokenBucket:
    """A token bucket rate limiter. See TASK.md."""

    def __init__(self, rate, capacity, clock=time.monotonic):
        raise NotImplementedError
