# Normalise slash-separated paths

Implement two functions in `normpath.py`. Paths are plain strings with `/` as the separator. Do not use `os.path`, `posixpath` or `pathlib`; the rules below differ from theirs.

## `normalize(path)` returns `str`

1. A path that starts with `/` is absolute, and the result starts with exactly one `/`, however many the path began with. Any other path is relative.
2. Runs of slashes count as one. Empty segments and `.` segments are dropped.
3. A `..` segment removes the segment before it. In an absolute path, `..` at the root is dropped: `/../a` is `/a`. In a relative path, `..` segments that have nothing left to remove are kept at the front: `a/../../b` is `../b`.
4. A trailing slash is dropped, except that the root stays `/`.
5. A relative path that comes out empty is `.`: `normalize("")`, `normalize("a/..")` and `normalize("./")` are all `.`.
6. Segments are otherwise kept as they are. `...` and `a..b` are ordinary names, and so is a segment of spaces.

## `join(base, *parts)` returns `str`

7. The parts are applied to `base` from left to right. A part that starts with `/` replaces everything before it. Any other part is appended after a `/`.
8. The result is normalised by rules 1 to 6. `join("/a/b", "../c")` is `/a/c`, and `join("a", "/x", "y")` is `/x/y`.
9. `join(base)` with no parts is `normalize(base)`. An empty part changes nothing.

Run the provided tests with `python3 -m unittest test_visible -v`.
