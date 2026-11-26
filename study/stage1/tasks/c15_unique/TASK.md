# Remove duplicates in order

After duplicates are removed the recently-viewed list comes back in a random order. Make `unique` in `dedupe.py` keep the first-seen order, and let callers pass a key.

## Rules

1. `unique(items, key=None)` returns a new list that holds the first item of each group of duplicates, in the order in which those items first appear: `unique([3, 1, 3, 2, 1])` is `[3, 1, 2]`.
2. Two items are duplicates when they are equal (`==`). So `1`, `1.0` and `True` are duplicates of each other: `unique([1, 1.0, True, 2])` is `[1, 2]`.
3. With a `key` function, two items are duplicates when their keys are equal. The result holds the items themselves, not their keys, and from each group the first item: `unique(["a", "A", "b"], key=str.lower)` is `["a", "b"]`.
4. Items and keys do not have to be hashable. `unique([[1], [2], [1]])` is `[[1], [2]]`, and a key function may return a list or a dict.
5. `items` may be any iterable, such as a tuple, a string or a generator, and the result is always a `list`: `unique("banana")` is `["b", "a", "n"]`. `items` is not changed.
6. `key` is called exactly once for each item, in the order of the items.
7. Any value may be a key, `None` and `0` included: `unique([1, 2, 3], key=lambda n: None)` is `[1]`.

Run the provided tests with `python3 -m unittest test_visible -v`.
