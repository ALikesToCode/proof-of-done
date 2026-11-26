# Token bucket

Implement the class `TokenBucket` in `bucket.py`. It limits how often something may happen. Time comes from a `clock` function that returns seconds, so tests can control it.

## `TokenBucket(rate, capacity, clock=time.monotonic)`

1. `rate` is the number of tokens added per second and `capacity` the most the bucket can hold. Both must be greater than 0, otherwise `ValueError`. They may be `int`, `float` or `fractions.Fraction`.
2. A new bucket is full.
3. Tokens are added continuously: after `t` seconds the bucket has gained `rate * t` tokens, never going above `capacity`. Time spent full is not saved up.

## Methods

4. `take(cost=1)` returns `True` and removes `cost` tokens when the bucket holds at least `cost`. Having exactly `cost` is enough. Otherwise it returns `False` and removes nothing.
5. `available()` returns the tokens in the bucket now.
6. `wait_time(cost=1)` returns the seconds until `take(cost)` would succeed, and `0` when it would succeed now. It changes nothing.
7. `cost` must be greater than 0 and at most `capacity`. Otherwise `take` and `wait_time` raise `ValueError`.
8. When the clock reports an earlier time than at the last call, no tokens are added and none are removed for that step.
9. Arithmetic is exact for exact inputs: with `int` or `Fraction` rate, capacity, cost and clock values, the results of `available` and `wait_time` are exact, with no floating-point error. For example a bucket with `rate=Fraction(1, 3)` gains exactly one token in 3 seconds.

Run the provided tests with `python3 -m unittest test_visible -v`.
