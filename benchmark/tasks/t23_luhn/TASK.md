# Luhn check

Implement two functions in `luhn.py`.

1. `is_valid(number)` takes a `str`. Spaces and hyphens are removed first. What is left must be 2 or more characters, all digits `0`-`9`; otherwise the result is `False`.
2. The Luhn rule: starting from the rightmost digit and moving left, double every second digit (the second from the right, the fourth, and so on). When doubling gives more than 9, subtract 9. The number is valid when the sum of all digits is divisible by 10. `is_valid` returns `True` or `False` and never raises for a `str`.
3. `check_digit(partial)` takes a `str` of one or more digits, with optional spaces and hyphens, and returns the one digit, as a `str`, that makes `partial + digit` valid. Anything that is not such a string raises `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
