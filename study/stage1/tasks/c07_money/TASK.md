# Split an amount without losing a cent

Splitting 1.00 three ways bills 0.33 three times and one cent goes missing. Fix `split_amount(cents, parts)` in `money.py` so the shares add up.

## Rules

1. The result is a list of `parts` shares. Each share is a whole number of cents (`int`), and the shares add up to `cents` exactly.
2. The shares are as equal as whole cents allow: no two shares differ by more than one cent. The left-over cents go one each to the first shares, so the larger shares come first: `split_amount(100, 3)` is `[34, 33, 33]` and `split_amount(101, 3)` is `[34, 34, 33]`.
3. An amount smaller than the number of parts leaves the last shares at 0: `split_amount(2, 4)` is `[1, 1, 0, 0]` and `split_amount(0, 2)` is `[0, 0]`.
4. A negative amount is a refund. It is split like the same amount without the sign, and then every share is negated: `split_amount(-100, 3)` is `[-34, -33, -33]` and `split_amount(-2, 4)` is `[-1, -1, 0, 0]`.
5. `parts` below 1 raises `ValueError`.
6. `cents` and `parts` are of type `int`. A `float` such as `100.0` or `3.0`, or a `str`, raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
