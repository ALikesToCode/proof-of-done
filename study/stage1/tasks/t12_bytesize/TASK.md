# Human-readable byte sizes

Implement two functions in `bytesize.py`.

## `format_size(count)` returns `str`

1. `count` is an `int` number of bytes. The units are `B`, `KiB`, `MiB`, `GiB` and `TiB`, each 1024 times the one before.
2. Below 1024 bytes the result is the count and `B`, with no decimal: `"0 B"`, `"1023 B"`.
3. From 1024 bytes on, the result has exactly one decimal and the largest unit in which the value is at least 1: `"1.0 KiB"`, `"1.5 KiB"`.
4. The value is rounded to one decimal, and an exact half rounds away from zero: 1280 bytes is exactly 1.25 KiB, which is `"1.3 KiB"`, and 2304 bytes (2.25 KiB) is `"2.3 KiB"`.
5. When rounding gives `1024.0`, the next unit is used: 1048575 bytes is `"1.0 MiB"`, not `"1024.0 KiB"`. `TiB` is the last unit, so values of 1024 TiB and more stay in `TiB`: `"2048.0 TiB"`.
6. A negative count is formatted as its absolute value with a leading `-`: `"-1.5 KiB"`.
7. A `bool` or a value that is not an `int` raises `TypeError`.

## `parse_size(text)` returns `int`

8. The text is a number, optional spaces, and a unit: `"1.5 KiB"`, `"1.5KiB"`, `"10 B"`. Spaces around the whole text are ignored. Units are matched exactly as written above; `kib` and `KB` are invalid.
9. The number is digits with an optional fraction of one or more digits, and an optional leading `-`. A fraction is not allowed with `B`.
10. The result is the exact number of bytes when that is a whole number, and `ValueError` when it is not: `"0.5 KiB"` is 512, and `"0.1 KiB"` is invalid.
11. Any other text raises `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
