# Read a settings file

A commented line in the settings file ends up as a setting named `# database`, and quoted values keep their quotes. Fix `parse_env(text)` in `envfile.py`. It reads `KEY=value` lines and returns a `dict` that maps `str` keys to `str` values. The examples below show the text of a line, or a Python call where the quoting matters.

## Rules

1. Each setting is one line of the form `KEY=value`. The line is split at the first `=`; any later `=` belongs to the value: `TOKEN=abc=def` gives `{"TOKEN": "abc=def"}`.
2. Whitespace around the key and around the value is dropped: `parse_env("  A = 1  ")` is `{"A": "1"}`. An empty value is allowed: `A=` gives `{"A": ""}`.
3. A line that is empty or only whitespace is skipped. A line whose first non-whitespace character is `#` is a comment and is skipped. A `#` anywhere else is part of the value: `COLOR=#fff` gives `{"COLOR": "#fff"}`.
4. When the trimmed value is at least two characters long and starts and ends with the same quote character, `"` or `'`, that pair of quotes is removed: `NAME="my app"` gives `{"NAME": "my app"}`. Whitespace inside the quotes is kept: `parse_env('PAD=" x "')` is `{"PAD": " x "}`.
5. Only one pair of quotes is removed: `parse_env('A=""x""')` is `{"A": '"x"'}`. Quotes that do not match are kept as written: `parse_env('B="x\'')` is `{"B": '"x\''}` and `parse_env('C="x')` is `{"C": '"x'}`. A value that is one quote character on its own is kept too: `parse_env('D="')` is `{"D": '"'}`.
6. A key that is set more than once takes its last value.
7. A line that is not blank and not a comment raises `ValueError` when it has no `=` or when its key is empty, as in `=5`.

Run the provided tests with `python3 -m unittest test_visible -v`.
