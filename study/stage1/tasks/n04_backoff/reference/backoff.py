import math


def _check(attempts, base, factor, cap, budget):
    if attempts is None:
        if budget is None:
            raise ValueError("without a limit on attempts a budget is required")
    elif attempts < 1:
        raise ValueError("attempts must be at least 1")
    if base < 1 or factor < 1:
        raise ValueError("base and factor must be at least 1")
    if cap is not None and cap < 1:
        raise ValueError("cap must be at least 1")
    if budget is not None and budget < 0:
        raise ValueError("budget must be at least 0")


def schedule(attempts, base, factor=2, cap=None, budget=None):
    """The delays between the tries of a retried operation. See TASK.md."""
    _check(attempts, base, factor, cap, budget)
    delays = []
    total = 0
    while attempts is None or len(delays) < attempts - 1:
        delay = math.floor(base * factor ** len(delays))
        if cap is not None:
            delay = min(delay, cap)
        if budget is not None and total + delay > budget:
            break
        delays.append(delay)
        total += delay
    return delays
