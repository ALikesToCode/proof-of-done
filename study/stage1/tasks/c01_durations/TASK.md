# Parse a duration string

Support tickets arrive with durations typed as text, such as `1h30m`. Add `parse_duration(text)` to `durations.py` so the importer can turn them into seconds. `format_duration(seconds)` is already there and stays as it is: 5400 gives `1h30m` and 0 gives `0s`.

## Rules

1. `parse_duration(text)` returns the duration in whole seconds as an `int`. The text is one or more parts, and a part is a whole number followed directly by a unit: `h` (3600 seconds), `m` (60 seconds) or `s`. `1h30m` is 5400, `45s` is 45 and `2h` is 7200.
2. A number is one or more of the digits `0`-`9`. It may be larger than the next unit holds and it may have leading zeros: `90m` is 5400, `05s` is 5 and `0s` is 0.
3. Units are lower-case. `1H` is invalid.
4. Parts come in the order hours, minutes, seconds, and no unit appears twice. `30m1h` and `1m2m` are invalid. A unit may be left out: `1h5s` is 3605.
5. Whitespace at the start and at the end of the text is ignored: `" 1h30m\n"` is 5400. Whitespace anywhere else is invalid, as in `1h 30m` and `1 h`.
6. Invalid text raises `ValueError`. That includes the empty string, text of only whitespace, a number with no unit (`1h30`), a unit with no number (`h`), an unknown unit (`10x`), a sign (`-5s`, `+5s`) and a fraction (`1.5h`).
7. An argument that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
