# Clean up article slugs

Article links come out as `hello--world-` when a title has punctuation or extra spaces. Fix `slugify(title)` in `slugs.py`, which turns a title into the last part of a link.

## Rules

1. The title is lower-cased. The letters `a`-`z` and the digits `0`-`9` are kept: `Top 10` gives `top-10`.
2. Every run of other characters becomes one hyphen, however long the run is: `Hello,  World!` gives `hello-world` and `a - b` gives `a-b`. An underscore is one of the other characters: `snake_case` gives `snake-case`.
3. The result never starts or ends with a hyphen: `  --Rock & Roll--  ` gives `rock-roll`.
4. Apostrophes, both `'` and `’`, are removed before anything else, so they do not split a word: `Don't Stop` gives `dont-stop`.
5. Only the ASCII letters and digits of rule 1 are kept. Any other letter or digit, such as `é`, `ß` or `²`, counts as one of the other characters: `Café au lait` gives `caf-au-lait` and `x² + 1` gives `x-1`.
6. A title with nothing to keep, such as the empty string or `!!!`, gives the empty string.
7. A title that is not a `str` raises `TypeError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
