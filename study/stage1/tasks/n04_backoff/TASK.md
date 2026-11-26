# Retry delays

Implement `schedule(attempts, base, factor=2, cap=None, budget=None)` in `backoff.py`. It plans the waits between the tries of an operation that is retried with exponential backoff, and returns them as a `list` in the order they are used. `base`, `cap` and `budget` are whole numbers of milliseconds.

## Rules

1. `attempts` is the total number of tries. A delay stands between two tries, so the list has `attempts - 1` delays unless a later rule ends it sooner: `schedule(4, 100)` is `[100, 200, 400]` and `schedule(1, 100)` is `[]`.
2. Delay number `i`, counting from 0, is `base * factor ** i`. `factor` is an `int` or a `fractions.Fraction`: `schedule(4, 100, factor=3)` is `[100, 300, 900]`.
3. Every delay in the list is an `int`. A value that is not whole is rounded down, and the rounding is never carried into later delays: with `base=100` and `factor=Fraction(3, 2)` the delays are 100, 150, 225, 337, 506, where the fifth is 506.25 rounded down and not 337 times 1.5.
4. With `cap`, a delay that would be larger than `cap` is `cap` instead: `schedule(5, 100, cap=350)` is `[100, 200, 350, 350]`.
5. With `budget`, the delays in the list never add up to more than `budget`: the list ends before the first delay that would take the sum above it. A sum equal to `budget` is allowed. `schedule(10, 100, budget=700)` is `[100, 200, 400]`, and with `budget=699` it is `[100, 200]`.
6. The cap is applied before the budget is checked: `schedule(10, 100, cap=150, budget=400)` is `[100, 150, 150]`.
7. `attempts=None` means there is no limit on the number of tries. Then `budget` is required, otherwise `ValueError`, and the list runs until the budget ends it: `schedule(None, 100, budget=700)` is `[100, 200, 400]`.
8. `attempts`, `base`, `factor` and `cap` must each be at least 1, and `budget` must be at least 0. Otherwise `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
