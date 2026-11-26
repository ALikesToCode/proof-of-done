# Fix the rounding in the ledger

`ledger.py` computes order totals in cents. Accounts reported this:

> A line of one item at 4.85 with a 50% discount was charged 2.42. It should be 2.43.

## What to change

1. **One rounding rule for the whole module.** Wherever the module rounds an amount to whole cents, an exact half rounds up: 242.5 cents is 243. Fix this everywhere the module rounds, not only where the report saw it.
2. **Exact arithmetic.** Amounts are computed exactly in decimal before rounding. A 30% discount on 35 cents is exactly 24.5 cents, which is 25. Binary floating point gets this wrong (`35 * 0.7` is `24.499999999999996`), so the result must not depend on it.
3. **Percentages** (`discount_percent`, `rate_percent`, `tax_rate_percent`) may be an `int`, a `float` or a `decimal.Decimal`. A `float` means its usual decimal notation: `8.25` means exactly 8.25 percent.
4. **`split_evenly(total_cents, parts)`** must return `parts` shares that add up to exactly `total_cents`. The shares differ by at most one cent, and the larger shares come first: `split_evenly(100, 3)` is `[34, 33, 33]`. `parts` below 1 raises `ValueError`.
5. Everything else keeps its behaviour: the function names, the argument order, `int` results in cents, and `order_total` as the sum of the line totals, the tax on that sum, and shipping.

All amounts are non-negative.

Run the provided tests with `python3 -m unittest test_visible -v`.
