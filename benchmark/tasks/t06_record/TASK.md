# Parse and format one delimited record

Implement two functions in `record.py`.

## `parse_record(text, delimiter=",")` returns `list[str]`

1. Fields are separated by the delimiter. The empty string is one empty field: `[""]`. `"a,,b"` is `["a", "", "b"]`, and `"a,"` is `["a", ""]`.
2. A field whose first character is `"` is a quoted field. It runs to the closing quote. Inside it, two quotes `""` stand for one quote character, and the delimiter, `"\n"` and `"\r"` are ordinary characters.
3. Right after the closing quote comes the delimiter or the end of the text. Anything else raises `ValueError`, so `"a"b` (with the quotes) is invalid. A quoted field that never closes raises `ValueError`.
4. A field that does not start with `"` is an unquoted field. It is taken as it is, and spaces are kept: `" a , b "` is `[" a ", " b "]`. A `"` anywhere inside an unquoted field raises `ValueError`, so `ab"c` is invalid.
5. `"\n"` or `"\r"` outside a quoted field raises `ValueError`. The function parses one record.

## `format_record(fields, delimiter=",")` returns `str`

6. The fields are joined with the delimiter. A field is written in quotes when it contains the delimiter, a `"`, `"\n"` or `"\r"`, or when it starts or ends with a space. Every other field, the empty string included, is written without quotes. Inside quotes, each `"` is doubled.
7. `fields` must hold at least one field, and every field must be a `str`. Otherwise `ValueError`.
8. For every valid `fields` and delimiter, `parse_record(format_record(fields, d), d) == list(fields)`.

## Both functions

9. `delimiter` must be exactly one character, and not `"`, `"\n"` or `"\r"`. Otherwise `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
