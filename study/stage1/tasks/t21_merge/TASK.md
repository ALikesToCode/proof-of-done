# Fix the configuration merge

`merge.py` has `deep_merge(base, override)`, which layers one configuration `dict` over another. A user reported:

> After `deep_merge(defaults, user)` my `defaults` dict has the user's values in it.

## What must hold

1. The function returns a new `dict`. Neither argument is changed, at any depth.
2. The result shares no `dict` or `list` object with either argument, at any depth. Changing the result later must never change an argument.
3. When a key holds a `dict` in both arguments, the two are merged by these same rules.
4. In every other case the value from `override` wins, including when one side is a `dict` and the other is not. Lists are replaced, not joined.
5. A key whose value in `override` is `None` is removed from the result. If the key is not in `base`, nothing happens. This applies at every depth.
6. Keys only in `base` are kept. Key order: the keys of `base` in their order, then the new keys of `override` in their order.

Run the provided tests with `python3 -m unittest test_visible -v`.
