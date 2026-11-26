# Refuse overdrafts

A withdrawal larger than the balance goes through and leaves a negative balance. Fix `Account` in `account.py` so that it refuses such a withdrawal and checks the amounts it is given. `Account(balance=0)` keeps its balance, a whole number of cents, in the attribute `balance`.

## Rules

1. `withdraw(amount)` lowers the balance by `amount` and returns the new balance: `Account(100).withdraw(40)` is `60`. Withdrawing the whole balance is allowed: `Account(100).withdraw(100)` is `0`.
2. When `amount` is larger than the balance, `withdraw` raises `InsufficientFunds`. `InsufficientFunds` is an exception class defined in `account.py` as a subclass of `Exception`.
3. An `InsufficientFunds` exception has two attributes: `balance`, the balance at the time, and `amount`, the amount that was asked for.
4. `withdraw` raises `ValueError` for an amount of zero or less.
5. `withdraw` raises `TypeError` for an amount that is not an `int`. A `float` is refused even when it is a whole number (`10.0`), and so are `True` and `False`.
6. `deposit(amount)` adds `amount` to the balance and returns the new balance. It raises `ValueError` for an amount of zero or less and `TypeError` for an amount that is not an `int`, exactly as `withdraw` does.
7. A call that raises leaves the balance unchanged.

Run the provided tests with `python3 -m unittest test_visible -v`.
