# Evaluate integer expressions

Implement `evaluate(text)` in `calc.py`. It returns the `int` value of an arithmetic expression. Do not use `eval`, `exec` or `ast`.

## Rules

1. Numbers are non-negative decimal integers such as `0`, `7` and `120`. A number with a leading zero, such as `007`, is invalid. There are no floats.
2. Binary operators, from lowest to highest precedence: `+` and `-`; then `*`, `//` and `%`; then `**`.
3. `+`, `-`, `*`, `//` and `%` associate to the left: `10 - 4 - 3` is 3. `**` associates to the right: `2 ** 3 ** 2` is 512.
4. Unary `-` and unary `+` may come before any operand and may repeat: `--3` is 3. A unary sign binds tighter than `*` and looser than `**`: `-2 ** 2` is -4, and `2 * -3` is -6. A unary sign may follow `**`: `2 ** -1` parses, and is then an error by rule 6.
5. `//` and `%` behave as in Python, flooring toward negative infinity: `-7 // 2` is -4 and `-7 % 2` is 1. A zero divisor raises `ZeroDivisionError`.
6. A negative exponent raises `ValueError`. `0 ** 0` is 1.
7. Parentheses group. Spaces and tabs may appear between tokens and are ignored. They may not appear inside a number or inside `//` or `**`: `1 0` and `2 * * 3` are invalid.
8. Everything else raises `ValueError`: an empty or blank string, unbalanced parentheses, `()`, a missing operand, the single `/` operator, and any other character.

Run the provided tests with `python3 -m unittest test_visible -v`.
