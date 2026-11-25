# Parse a duration string

Implement `parse_duration(text)` in `duration.py`. It returns the duration as a whole number of milliseconds (`int`).

## Rules

1. A duration is one or more components. A component is a non-negative decimal number followed directly by a unit, as in `90s`. Digits are `0`-`9` only.
2. The units are `w` (7 days), `d` (24 hours), `h`, `m` (minutes), `s` and `ms`. Units are lower-case; `1H` is invalid.
3. Components appear in strictly descending unit order (`w`, `d`, `h`, `m`, `s`, `ms`), and no unit appears twice. `30m1h` and `1h2h` are invalid.
4. Components are written with nothing between them or with exactly one space between them: `1h30m` and `1h 30m` are the same. Whitespace around the whole string is ignored. Whitespace between a number and its unit is invalid (`1 h`).
5. Only the last component may have a fraction. `1h30.5m` is valid and `1.5h30m` is invalid. A fraction has digits on both sides of the point: `.5h` and `5.h` are invalid.
6. The value is computed exactly and then rounded to the nearest millisecond. Exact halves round away from zero: `2.5ms` is 3 and `0.0005s` is 1.
7. One leading `-` negates the whole duration: `-1h30m` is -5400000 and `-2.5ms` is -3. A leading `+` is invalid. `-0s` is 0.
8. Invalid text raises `ValueError`. That includes the empty string, a string of only whitespace, and a number with no unit. An argument that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
