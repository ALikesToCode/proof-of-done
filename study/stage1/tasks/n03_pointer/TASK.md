# Resolve a JSON pointer

Implement `resolve(document, pointer)` in `pointer.py`. `document` is data as `json.loads` returns it: dicts with string keys, lists, strings, numbers, booleans and `None`. `pointer` is a string that names one value inside the document, and `resolve` returns that value.

## Rules

1. The pointer `""` names the whole document. Every other pointer must start with `/`, otherwise `ValueError`.
2. The text after each `/` is one token, and the tokens are applied from left to right, each to the value the tokens before it led to. `/a/b` has the tokens `a` and `b`. A token may be empty: `/` has one token, the empty string, and `/a//b` has the tokens `a`, the empty string and `b`.
3. In a token, `~1` stands for `/` and `~0` stands for `~`. Decoding makes one pass from left to right, so `~01` is the two characters `~1`, not `/`. A `~` followed by any other character, or at the end of a token, raises `ValueError`.
4. When the current value is a dict, the decoded token is looked up as a key, with no conversion: `/0` looks up the key `"0"` and `/` looks up the key `""`. A key that is missing raises `KeyError`.
5. When the current value is a list, the token must be an index written as `0` or as digits `0`-`9` that do not start with `0`. Any other token (`-1`, `01`, `1.5`, `+1`, `-`, a name, the empty string) raises `ValueError`. An index past the end of the list raises `IndexError`.
6. When the current value is anything else (a string, a number, a boolean or `None`) and a token is left, `TypeError` is raised. A string is never indexed: `resolve({"a": "xyz"}, "/a/0")` raises `TypeError`.
7. A `pointer` that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
