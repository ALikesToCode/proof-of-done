# Parse INI text

Implement `parse_ini(text)` in `ini.py`. It returns a `dict` that maps each section name to a `dict` of its keys and values. All names and values are `str`. Do not use `configparser`.

## Rules

1. Lines end at `"\n"`. A `"\r"` before the `"\n"` is dropped.
2. A line that is empty or only whitespace is skipped. A line whose first non-whitespace character is `;` or `#` is a comment and is skipped.
3. `[name]` on a line of its own starts a section. Whitespace around the brackets and inside them is trimmed: `[ db ]` is the section `db`. Section names are case-sensitive. An empty name (`[]`) is an error.
4. `key = value` sets a key in the current section. The line is split at the **first** `=`. Key and value are trimmed. Keys are lower-cased; values are kept as written. An empty value is allowed (`key =`). An empty key is an error.
5. `;` and `#` start a comment only at the start of a line. In `url = http://x/#top ; note` the value is `http://x/#top ; note`.
6. Keys that come before any section header go into the section named `""`. That section is in the result only when it has at least one key.
7. A line that starts with a space or a tab, and is not blank or a comment, continues the value of the key before it: its trimmed text is appended after one `"\n"`. A continuation with no key before it in the same section is an error. A section header ends the reach of a continuation.
8. The same key twice in a section: the last value wins. The same section twice: its keys are merged into one dict, later keys winning.
9. A section with no keys is in the result with an empty dict.
10. Any other line is an error. Errors raise `ValueError` whose message contains `line N`, where `N` is the 1-based number of the bad line.

Run the provided tests with `python3 -m unittest test_visible -v`.
