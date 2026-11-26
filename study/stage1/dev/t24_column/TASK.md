# Spreadsheet column names

Implement two functions in `column.py`.

1. `column_name(index)` returns the spreadsheet name of the column with the 1-based `index`: 1 is `A`, 26 is `Z`, 27 is `AA`, 52 is `AZ`, 53 is `BA`, 702 is `ZZ`, 703 is `AAA`.
2. `column_index(name)` reverses it. It accepts upper-case and lower-case letters.
3. `column_name` raises `ValueError` for an index below 1. `column_index` raises `ValueError` for the empty string and for any character that is not one of the letters A to Z or a to z.

Run the provided tests with `python3 -m unittest test_visible -v`.
