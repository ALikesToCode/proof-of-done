# Keep truncated titles inside the card

Card titles are cut to 20 characters and then get three dots added, so they are 23 wide and wrap. Fix `truncate(value, width)` in `text.py`.

## Rules

1. The result is never longer than `width` characters.
2. A value of `width` characters or fewer is returned unchanged. That includes a value of exactly `width` characters: `truncate("abcdefghij", 10)` is `"abcdefghij"`.
3. A longer value is cut to its first `width - 3` characters and `"..."` is added, so the dots are counted in the width: `truncate("abcdefghijklmnop", 10)` is `"abcdefg..."`.
4. Whitespace is not left in front of the dots. When the kept part ends in whitespace, that whitespace is removed before the dots are added, and the result is then shorter than `width`: `truncate("hello world again", 9)` is `"hello..."`.
5. A value that fits is not trimmed: `truncate("  hi  ", 10)` is `"  hi  "`.
6. A `width` below 4 raises `ValueError`. That is checked first, so it also holds for a value that would fit: `truncate("ab", 3)` raises.
7. A `value` that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
