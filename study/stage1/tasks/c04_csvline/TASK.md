# Quoted fields in a CSV line

Addresses such as `"12 High St, Leeds"` are split into two columns by the importer. Make `split_line(line)` in `csvline.py` respect double quotes. It returns the fields of one line as a list of `str`.

## Rules

1. Fields are separated by commas: `a,b,c` gives `["a", "b", "c"]`. An empty field stays in the list as `""`: `a,,b` gives `["a", "", "b"]`, `a,` gives `["a", ""]` and the empty line gives `[""]`.
2. Spaces and tabs around a field are dropped: `a , b` gives `["a", "b"]`.
3. A field may be written in double quotes. The quotes are dropped, and a comma between them does not split the field: `a,"b,c",d` gives `["a", "b,c", "d"]`.
4. Inside a quoted field, two double quotes in a row stand for one quote character: `"say ""hi""",x` gives `['say "hi"', "x"]`.
5. The text between the quotes is kept exactly as written, spaces at its ends included: `" a ",b` gives `[" a ", "b"]`. Spaces and tabs outside the quotes are still dropped: `a, "b,c" ,d` gives `["a", "b,c", "d"]`.
6. A quoted field that is never closed raises `ValueError`, as in `a,"b`.
7. Quotes go around the whole field. A field with any text other than spaces and tabs before its opening quote or after its closing quote raises `ValueError`, as in `ab"c",d` and `"a"b,c`.

Run the provided tests with `python3 -m unittest test_visible -v`.
