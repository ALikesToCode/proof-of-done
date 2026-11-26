# Flip a table

Flipping a table with two rows and three columns drops the third column. Fix `transpose(rows)` in `grid.py`, and make it refuse tables whose rows differ in length. A table is a list of rows, and a row is a list of cells.

## Rules

1. `transpose(rows)` returns a list of lists. Row `c` of the result holds cell `c` of every input row, in the order of the input rows. The table need not be square: `[[1, 2, 3], [4, 5, 6]]` gives `[[1, 4], [2, 5], [3, 6]]` and `[[1], [2], [3]]` gives `[[1, 2, 3]]`.
2. An empty table gives an empty table: `[]` gives `[]`. A table whose rows are all empty has no columns, so `[[], []]` also gives `[]`.
3. Rows of different lengths raise `ValueError`, whichever row is the longer one: `[[1, 2], [3]]` and `[[1], [2, 3]]` are both refused, and so is `[[], [1]]`.
4. A row may be a tuple as well as a list. The rows of the result are always lists: `[(1, 2), (3, 4)]` gives `[[1, 3], [2, 4]]`.
5. Cells are moved as they are, whatever their type. A cell that is itself a list is one cell and is not opened: `[["a", [1]], [None, 2.5]]` gives `[["a", None], [[1], 2.5]]`.
6. The result is built from new lists. `rows` and the rows inside it are not changed, and changing the result afterwards does not change them.

Run the provided tests with `python3 -m unittest test_visible -v`.
