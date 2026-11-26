# Add expiry to the LRU cache

`lru.py` holds `LRUCache`, a least-recently-used cache with an injectable clock. Add time-to-live (TTL) support.

## New behaviour

1. `LRUCache(capacity, ttl=None, clock=time.monotonic)`: `ttl` is the default lifetime of an entry in seconds. `None` means entries never expire.
2. `put(key, value, ttl=USE_DEFAULT)`: a `ttl` given here overrides the default for this entry. Passing `ttl=None` here makes this entry never expire, also when the cache has a default.
3. A `ttl` that is not `None` must be greater than 0. Otherwise the constructor or `put` raises `ValueError`, and `put` stores nothing.
4. An entry is expired as soon as `clock() - stored_at >= ttl`. At exactly `ttl` seconds it is already expired.
5. An expired entry behaves as absent everywhere: `get` and `peek` return the default, `key in cache` is false, `len(cache)` does not count it, and `keys()` does not list it.
6. Expired entries never cost a live entry its place. When `put` adds a new key to a full cache, expired entries are removed first, and a live entry is evicted only if the cache is still full after that.
7. `put` on a key that is already present replaces the value, restarts its lifetime from now with the ttl of this call, and makes it the most recently used.
8. `get` makes the entry most recently used. It does not restart the lifetime. `peek` changes nothing.

## Behaviour that stays

- `capacity` below 1 raises `ValueError`.
- `get(key, default=None)` and `peek(key, default=None)` return `default` for an absent key.
- When a new key is added to a full cache, the least recently used live entry is evicted.
- `keys()` lists the keys from least to most recently used.

Run the provided tests with `python3 -m unittest test_visible -v`.
