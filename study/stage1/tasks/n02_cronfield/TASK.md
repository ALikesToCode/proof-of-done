# Expand a cron field

Implement `expand_field(field, low, high)` in `cronfield.py`. `field` is one field of a cron line, such as the minutes field `*/15`. `low` and `high` are the smallest and the largest value that field can hold (0 and 59 for minutes). The function returns the values the field matches as a sorted `list` of `int` with no duplicates.

## Rules

1. A field is one or more parts separated by `,`. The result holds every value matched by at least one part: `expand_field("5,1,5", 0, 59)` is `[1, 5]`.
2. The part `*` matches every value from `low` to `high`. A part that is a single number matches that number.
3. The part `a-b` is a range and matches every value from `a` to `b`, both included. `a` must not be greater than `b`: `5-3` is invalid, and `4-4` matches 4.
4. `*` or a range may be followed by `/n`, a step. The part then matches the first value that the `*` or the range matches and every `n`-th value after it. With 0 and 59, `*/15` is `[0, 15, 30, 45]` and `10-20/4` is `[10, 14, 18]`. The step must be at least 1, and it may be larger than `high`.
5. A single number followed by a step, `a/n`, means `a-high/n`: with 0 and 59, `50/4` is `[50, 54, 58]`.
6. Every number other than a step must lie from `low` to `high`. With 1 and 12, `0`, `13/2` and `10-13` are invalid.
7. A number is written with the digits `0`-`9` only, and leading zeros are allowed: `05` is 5. A sign, a space or an underscore anywhere in the field makes it invalid: `+5`, `1, 2` and `1_0` are invalid.
8. An invalid field raises `ValueError`. That includes the empty string, an empty part (`1,,2` or `1,`), a part with a missing number (`-5`, `3-`, `*/`, `/5`), names such as `MON`, and any other part that is not one of the forms above (`1-2-3`, `*-5`).

Run the provided tests with `python3 -m unittest test_visible -v`.
