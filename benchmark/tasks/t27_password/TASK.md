# Add two rules to the password check

`password.py` has `problems(password, username="")`. It returns the list of rule names the password breaks, and `[]` for a good password. Add two rules and keep the rest.

## The rules, in the order their names must appear in the result

1. `too_short`: fewer than 10 characters.
2. `no_lower`: no lower-case letter. 3. `no_upper`: no upper-case letter. 4. `no_digit`: no digit `0`-`9`.
5. `no_symbol`: no character that is neither a letter, a digit nor whitespace.
6. `has_whitespace`: any whitespace character.
7. **New** `repeated`: the same character three or more times in a row, such as `aaa`. Two in a row is fine. The comparison is case-sensitive.
8. **New** `contains_username`: the username appears in the password, ignoring case. The rule is skipped when the username is shorter than 3 characters.

Each name appears at most once. The result is always in the order above, whatever order the checks run in.

Run the provided tests with `python3 -m unittest test_visible -v`.
