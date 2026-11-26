# A read counts as a use

Hot entries keep falling out of the session cache. A read should count as a use. Fix `LRUCache` in `cache.py`.

## Rules

1. `LRUCache(capacity)` holds at most `capacity` entries. When `put` adds a new key to a full cache, the least recently used entry is dropped first. An entry is used when it is put and when it is read with `get`.
2. `get(key, default=None)` returns the stored value and counts as a use: with capacity 2, after `put("a", 1)`, `put("b", 2)`, `get("a")` and `put("c", 3)` the cache holds `a` and `c` and has dropped `b`.
3. `get` of a key that is not in the cache returns `default`. It stores nothing and changes no order.
4. `put` of a key that is already in the cache replaces its value and counts as a use. Nothing is dropped, even when the cache is full.
5. `key in cache` and `len(cache)` do not count as a use.
6. A new method `keys()` returns the keys as a list, from the least recently used to the most recently used. Calling it does not count as a use.
7. Any value can be stored, `None` included: `get` then returns the stored `None` and not `default`, and the entry stays in the cache.
8. A `capacity` below 1 raises `ValueError` when the cache is created.

Run the provided tests with `python3 -m unittest test_visible -v`.
