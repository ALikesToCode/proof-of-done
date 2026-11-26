# Flatten to a depth

The menu export needs only the top level of nesting removed, and `flatten` in `nested.py` always goes all the way down. Add a `depth` argument.

## Rules

1. `flatten(items, depth=None)` returns a new list. With `depth=None` it removes every level of list nesting, as it did before: `flatten([1, [2, [3, [4]]]])` is `[1, 2, 3, 4]`.
2. With a whole number as `depth` it removes that many levels and no more. For `[1, [2, [3, [4]]]]`, `depth=1` gives `[1, 2, [3, [4]]]` and `depth=2` gives `[1, 2, 3, [4]]`.
3. `depth=0` removes nothing. The result is a new list that holds the same objects as `items`, so the lists inside it are not copied: `flatten([1, [2, [3]]], depth=0)` is `[1, [2, [3]]]`.
4. A `depth` larger than the nesting is not an error; the list is then flattened completely: `flatten([1, [2, [3]]], depth=10)` is `[1, 2, 3]`.
5. A negative `depth` raises `ValueError`.
6. Only `list` values are opened. Strings, tuples and every other value stay whole: `flatten(["ab", ["cd"]], depth=1)` is `["ab", "cd"]`, and `flatten([(1, 2), [3]])` is `[(1, 2), 3]`.
7. An empty list disappears when its level is removed: `flatten([1, [], [[]]])` is `[1]`, and `flatten([1, [], [[]]], depth=1)` is `[1, []]`.
8. `items` and the lists inside it are not changed.

Run the provided tests with `python3 -m unittest test_visible -v`.
