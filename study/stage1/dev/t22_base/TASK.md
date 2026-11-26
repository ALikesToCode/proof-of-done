# Number bases

Implement two functions in `base.py`.

1. `to_base(number, base)` returns the `int` `number` written in `base` (2 to 36), with the digits `0`-`9` then lower-case `a`-`z`. Zero is `"0"`. A negative number gets a leading `-`.
2. `from_base(text, base)` reverses it. It accepts lower-case and upper-case digits and one optional leading `-`.
3. A base outside 2 to 36 raises `ValueError` in both functions.
4. `from_base` raises `ValueError` for the empty string, a lone `-`, a digit that is not valid in the base, and any other character, spaces included.

Run the provided tests with `python3 -m unittest test_visible -v`.
