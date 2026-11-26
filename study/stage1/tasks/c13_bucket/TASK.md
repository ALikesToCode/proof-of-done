# Refill the token bucket

Once a client uses up its requests it stays blocked for ever. `TokenBucket` in `bucket.py` should fill again over time. The class reads no clock: every call of `allow` is given the current time `now` in seconds, as an `int` or a `float`.

## Rules

1. `TokenBucket(capacity, per_second)` starts full, with `capacity` tokens.
2. `allow(now)` returns `True` and removes one token when the bucket holds at least one whole token. Otherwise it returns `False` and removes nothing.
3. Before it decides, `allow(now)` adds `per_second` tokens for each second that has passed since the previous call of `allow`, whether that call returned `True` or `False`. With `TokenBucket(2, 1)`, two calls at `now=0` return `True`, a third at `now=0` returns `False`, and a call at `now=1` returns `True`.
4. Parts of a second count, and a part of a token is kept until it is whole: with `TokenBucket(1, 1)`, after `allow(0)` the call `allow(0.5)` returns `False` and the call `allow(1.0)` then returns `True`.
5. The bucket never holds more than `capacity` tokens, so time spent full is not saved up. With `TokenBucket(2, 1)` emptied at `now=0`, three calls at `now=100` return `True`, `True` and `False`.
6. Time does not run backwards. When `now` is earlier than the latest time the bucket has seen, no tokens are added and the bucket keeps that latest time, so the same seconds are never paid for twice. With `TokenBucket(1, 1)`, `allow(10)` is `True`, `allow(5)` is `False`, `allow(10)` is still `False` and `allow(11)` is `True`.
7. `capacity` and `per_second` must both be greater than 0. Otherwise the constructor raises `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
