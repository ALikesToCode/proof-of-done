# Fix the minimum of the stack

`minstack.py` holds `MinStack`, a stack that also reports its smallest value. A user reported:

> After `push(3)`, `push(1)`, `pop()`, the call `get_min()` returns 1. It should return 3.

## What must hold

1. `push(value)`, `pop()` and `top()` behave as a stack. `pop()` returns the removed value.
2. `get_min()` returns the smallest value now on the stack, after any mix of pushes and pops. Equal values are separate entries: after `push(1)`, `push(1)`, `pop()` the minimum is still 1.
3. `pop()` and `top()` on an empty stack raise `IndexError`. `get_min()` on an empty stack raises `ValueError`.
4. `len(stack)` is the number of values on it.
5. `push`, `pop`, `top` and `get_min` each take constant time. Do not scan the stack to find the minimum.

Run the provided tests with `python3 -m unittest test_visible -v`.
