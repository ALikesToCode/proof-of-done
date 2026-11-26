# Add Kelvin to the converter

The lab sensors report Kelvin, and `convert(value, source, target)` in `temperature.py` only knows Celsius and Fahrenheit. Add Kelvin, and refuse readings below absolute zero.

## Rules

1. The units are `"C"` (Celsius), `"F"` (Fahrenheit) and `"K"` (Kelvin). Fahrenheit is Celsius × 9 / 5 + 32, and Kelvin is Celsius + 273.15. `convert(0, "C", "K")` is `273.15` and `convert(100, "C", "F")` is `212.0`.
2. Every unit converts to every other unit, Fahrenheit and Kelvin included: `convert(212, "F", "K")` is `373.15` and `convert(273.15, "K", "F")` is `32.0`.
3. The result is a `float` rounded to 2 decimal places with Python's `round`. `convert(300, "K", "C")` is exactly `26.85`, and `convert(0, "F", "K")` is exactly `255.37`.
4. When `source` and `target` are the same unit the value comes back, also as a `float` rounded to 2 decimal places: `convert(20, "C", "C")` is `20.0` and `convert(1.234, "K", "K")` is `1.23`. The checks for an unknown unit and for absolute zero are made in this case too.
5. A unit other than `"C"`, `"F"` and `"K"` raises `ValueError`, whether it is given as `source` or as `target`. Units are case-sensitive, so `"k"` is unknown. `convert(1, "X", "X")` raises `ValueError` as well.
6. A value below absolute zero in its source unit raises `ValueError`: below `0` in K, below `-273.15` in C and below `-459.67` in F. Absolute zero itself is allowed: `convert(-273.15, "C", "K")` is `0.0`.

Run the provided tests with `python3 -m unittest test_visible -v`.
