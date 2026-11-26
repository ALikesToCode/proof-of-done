# Compare versions as numbers

The update check tells people on 1.10.0 that 1.9.0 is newer. Fix `compare(a, b)` in `versions.py`. It returns -1, 0 or 1 as version `a` is older than, equal to or newer than version `b`.

## Rules

1. A version is `MAJOR.MINOR.PATCH`: three numbers joined by dots, each written with one or more of the digits `0`-`9`. The numbers are compared as numbers, left to right: `compare("1.10.0", "1.9.0")` is 1 and `compare("2.0.0", "10.0.0")` is -1.
2. Leading zeros change nothing: `compare("1.02.0", "1.2.0")` is 0.
3. A version may end with a pre-release tag: a hyphen followed by one or more ASCII letters and digits, as in `1.2.0-rc1`. A version with a tag is older than the same three numbers without a tag: `compare("1.2.0-rc1", "1.2.0")` is -1.
4. The numbers decide first. Tags are looked at only when all three numbers are equal: `compare("1.3.0-rc1", "1.2.9")` is 1.
5. Two tags on equal numbers are compared as Python compares two `str` values: `compare("1.2.0-alpha", "1.2.0-beta")` is -1, `compare("1.2.0-rc2", "1.2.0-rc1")` is 1 and `compare("1.2.0-rc10", "1.2.0-rc9")` is -1. Equal tags give 0.
6. Any other text is not a version and raises `ValueError`, whichever argument it is. That covers fewer or more than three numbers (`1.2`, `1.2.3.4`), an empty part (`1..3`), a part with a sign, a space or a letter (`+1.2.3`, `1. 2.3`, `1.x.0`), an empty tag (`1.2.0-`), a tag with any other character (`1.2.0-rc.1`), and the empty string.
7. An argument that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
