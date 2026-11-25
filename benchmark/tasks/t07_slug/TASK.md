# Length limits and unique slugs

`slug.py` turns a title into a URL slug. Add a length limit to `slugify` and a new function `unique_slug`.

## How `slugify(title)` works today (keep all of it)

- The title is lower-cased. Accented letters lose their accents (`é` becomes `e`). Every run of characters other than `a`-`z` and `0`-`9` becomes one hyphen. Hyphens at the start and the end are removed.
- A title that leaves nothing gives `"untitled"`.

## New: `slugify(title, max_length=None)`

1. With `max_length=None` the result is as today.
2. A slug is a list of words joined by hyphens. When the slug is longer than `max_length`, it is shortened to the longest run of whole leading words that fits in `max_length` characters. `slugify("the quick brown fox", 12)` is `"the-quick"`, because `"the-quick-br"` would cut a word.
3. When the first word alone is longer than `max_length`, that word is cut to exactly `max_length` characters: `slugify("extraordinary", 5)` is `"extra"`.
4. The result never starts or ends with a hyphen and is never longer than `max_length`.
5. `"untitled"` is shortened by the same rule: `slugify("!!!", 3)` is `"unt"`.
6. `max_length` below 1 raises `ValueError`.

## New: `unique_slug(title, taken, max_length=None)`

7. `taken` is any collection of slugs that are in use (a list, a set or a tuple). It is not changed.
8. When `slugify(title, max_length)` is not in `taken`, that is the result.
9. Otherwise the result is the base slug with a suffix: `-2`, then `-3`, and so on. The first one that is not in `taken` wins. `unique_slug("Hello", ["hello", "hello-2"])` is `"hello-3"`.
10. With `max_length`, the whole result, suffix included, is at most `max_length` characters. The base is shortened by rules 2 to 4 to `max_length` minus the length of the suffix, and that is done again for each suffix that is tried, because `-10` is longer than `-9`. `unique_slug("the quick brown", {"the-quick"}, 12)` is `"the-quick-2"`, and with `max_length=10` it is `"the-2"`.
11. When a suffix leaves less than one character for the base, `ValueError` is raised.

Run the provided tests with `python3 -m unittest test_visible -v`.
