# Fix the searches on a sorted list

`search.py` searches a list that is sorted in ascending order and may hold duplicates. A user reported:

> `find_last([1, 2, 2, 3], 3)` returns -1. The 3 is right there at the end.

Fix the module so that all four functions hold to these rules.

1. `find_first(items, value)` is the index of the first item equal to `value`, or -1.
2. `find_last(items, value)` is the index of the last item equal to `value`, or -1.
3. `count_of(items, value)` is how many items equal `value`.
4. `insert_position(items, value)` is the index at which `value` can be inserted **after** any equal items so that the list stays sorted. For `[1, 2, 2, 3]` and 2 it is 3, and for 9 it is 4.
5. All four work on the empty list, on a list of one item, and when `value` is smaller or larger than every item.
6. All four run in logarithmic time. Do not walk the list.

Run the provided tests with `python3 -m unittest test_visible -v`.
