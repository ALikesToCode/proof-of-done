# Chunks and sliding windows

Implement two functions in `chunks.py`. Both take a `list` and return a `list` of `list`s, and neither changes its argument.

1. `chunk(items, size)` cuts the list into consecutive pieces of `size` items. The last piece may be shorter. An empty list gives `[]`.
2. `sliding(items, size, step=1)` returns every window of exactly `size` consecutive items, starting at positions 0, `step`, `2 * step`, and so on. A window that would run past the end is left out. A list shorter than `size` gives `[]`.
3. `size` and `step` must be `int`s of at least 1, otherwise `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
