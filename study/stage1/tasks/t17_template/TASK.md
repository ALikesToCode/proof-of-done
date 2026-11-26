# Fill a text template

Implement `render(template, values)` in `template.py`. It returns the template with each field replaced. `values` is a `dict`.

## Rules

1. A field is `{path}`. A path is one or more names joined by dots, such as `user.name`. A name is letters, digits and underscores. Whitespace inside the braces around the path is ignored: `{ user.name }`.
2. The first name is looked up in `values`. Each later name is looked up in the value found so far: as a key when that value is a `dict`, and as an index when it is a `list` or a `tuple` and the name is all digits (`items.0`). Attribute lookup is never used.
3. A found value is inserted as `str(value)`, except that `None` is inserted as the empty string, and `True` and `False` as `true` and `false`.
4. `{path|text}` gives a default. When the lookup fails at any step, `text` is inserted exactly as written, spaces included, up to the closing brace. The default may be empty: `{name|}`. A value that is found and is `None` is not a failed lookup.
5. A failed lookup with no default raises `KeyError` whose first argument is the full path as written in the field, trimmed, such as `"user.name"`.
6. `{{` is a literal `{` and `}}` is a literal `}`. They are not fields.
7. These raise `ValueError`: a `{` with no closing `}`, a `}` with no opening `{`, an empty field `{}`, a path that is not valid by rule 1 (such as `{a..b}` or `{a-b}`), and a `{` inside a field.
8. Text outside fields is copied unchanged. Inserted values are not scanned again for fields.

Run the provided tests with `python3 -m unittest test_visible -v`.
