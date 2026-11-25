# Roman numerals

Implement two functions in `roman.py`.

1. `to_roman(number)` returns the Roman numeral for an `int` from 1 to 3999, in the standard subtractive form: 4 is `IV`, 9 is `IX`, 40 is `XL`, 90 is `XC`, 400 is `CD`, 900 is `CM`. A number outside 1 to 3999 raises `ValueError`.
2. `from_roman(text)` returns the `int` for a numeral. It accepts only the exact text that `to_roman` produces for some number. Everything else raises `ValueError`: lower case (`iv`), the empty string, other characters, and non-standard forms such as `IIII`, `VX`, `IC` or `MMMM`.

Run the provided tests with `python3 -m unittest test_visible -v`.
