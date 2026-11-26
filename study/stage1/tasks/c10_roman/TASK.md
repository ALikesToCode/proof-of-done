# Subtractive Roman numerals

The table of contents numbers chapters IIII, VIIII and XXXX. Use the usual subtractive forms in `to_roman(number)` in `roman.py`.

## Rules

1. `to_roman(number)` writes a whole number as a Roman numeral in upper case. The letters are `M` 1000, `D` 500, `C` 100, `L` 50, `X` 10, `V` 5 and `I` 1, and larger values come first: 3 is `III`, 6 is `VI` and 2000 is `MM`.
2. Six subtractive forms replace four equal letters in a row: 4 is `IV`, 9 is `IX`, 40 is `XL`, 90 is `XC`, 400 is `CD` and 900 is `CM`. No other subtractive form is used.
3. Each decimal digit of the number is written on its own, thousands first: 1994 is `M`, `CM`, `XC`, `IV`, so `MCMXCIV`. 49 is `XLIX` and not `IL`, and 999 is `CMXCIX` and not `IM`.
4. The number must be from 1 to 3999. Zero, a negative number and any number from 4000 up raise `ValueError`. 1 is `I` and 3999 is `MMMCMXCIX`.
5. The number must be an `int`. A `float` such as `4.0`, a `str` such as `"4"` and `None` raise `TypeError`.
6. `True` and `False` do not count as numbers here and raise `TypeError` too.

Run the provided tests with `python3 -m unittest test_visible -v`.
