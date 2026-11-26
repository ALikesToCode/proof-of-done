# Match a path against a glob pattern

Implement `matches(pattern, path)` in `glob_match.py`. It returns `True` when the whole `path` matches the whole `pattern`, and `False` otherwise. Do not use `fnmatch`, `glob` or `pathlib` matching.

## Rules

1. A path is segments separated by `/`. Matching is case-sensitive.
2. `?` matches exactly one character that is not `/`.
3. `*` matches zero or more characters that are not `/`. It never crosses a slash: `*.py` does not match `src/a.py`.
4. `**` is special only when it is a whole segment (`**/x`, `a/**/b`, `a/**`). It then matches zero or more whole segments: `a/**/b` matches `a/b`, `a/x/b` and `a/x/y/b`. `**` alone matches every path, the empty path included.
5. Inside a segment with other characters, `**` is two `*` in a row and acts like one `*`: `a**b` matches `axxb` and not `a/b`.
6. `[abc]` matches one character from the set, and `[a-c]` one character from the range. `[!abc]` matches one character that is not in the set. A class never matches `/`. `]` directly after `[` or `[!` is a literal member of the set: `[]x]` matches `]` or `x`.
7. `\` makes the next character literal: `\*` matches a star, and `\\` a backslash. Inside a class, characters are literal except for the rules in 6; a backslash there stands for itself.
8. A pattern with an unclosed `[` or a `\` at its very end raises `ValueError`. So does a range whose end is before its start, such as `[c-a]`.
9. Every other character matches itself. The empty pattern matches only the empty path.

Run the provided tests with `python3 -m unittest test_visible -v`.
