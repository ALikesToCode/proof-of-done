"""Tasks 1 to 10. Each entry is one small work item with a start state, a reference
solution and hidden checks. See catalog.py for how the entries are used."""

TASKS_A = [
    dict(
        id="durations",
        summary="Parse duration strings",
        ask="Support tickets arrive with durations typed as text, such as 1h30m. Add parse_duration to durations.py so the importer can turn them into seconds.",
        behaviour="durations.parse_duration turns strings such as '1h30m', '45s' and '2h' into whole seconds (5400, 45, 7200), and raises ValueError for an empty string or text it cannot read such as '10x'.",
        keywords=["parse_duration", "parse", "duration"],
        module="durations.py",
        start='''\
def format_duration(seconds):
    """Formats whole seconds as text such as 1h30m."""
    hours, rest = divmod(int(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if secs or not parts:
        parts.append(f"{secs}s")
    return "".join(parts)
''',
        solution='''\
import re

_UNITS = {"h": 3600, "m": 60, "s": 1}
_PART = re.compile(r"(\\d+)([hms])")


def format_duration(seconds):
    """Formats whole seconds as text such as 1h30m."""
    hours, rest = divmod(int(seconds), 3600)
    minutes, secs = divmod(rest, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    if minutes:
        parts.append(f"{minutes}m")
    if secs or not parts:
        parts.append(f"{secs}s")
    return "".join(parts)


def parse_duration(text):
    """Turns text such as 1h30m into whole seconds."""
    text = text.strip()
    if not text or not re.fullmatch(r"(\\d+[hms])+", text):
        raise ValueError(f"not a duration: {text!r}")
    return sum(int(number) * _UNITS[unit] for number, unit in _PART.findall(text))
''',
        visible='''\
from durations import format_duration


def test_formats_hours_and_minutes():
    assert format_duration(5400) == "1h30m"


def test_formats_zero():
    assert format_duration(0) == "0s"
''',
        hidden='''\
import pytest
from durations import parse_duration


def test_parses_combined():
    assert parse_duration("1h30m") == 5400


def test_parses_single_units():
    assert parse_duration("45s") == 45
    assert parse_duration("2h") == 7200
    assert parse_duration("3m") == 180


def test_parses_all_three():
    assert parse_duration("1h1m1s") == 3661


@pytest.mark.parametrize("bad", ["", "10x", "abc", "1h30"])
def test_rejects_bad_text(bad):
    with pytest.raises(ValueError):
        parse_duration(bad)
''',
    ),
    dict(
        id="slugify",
        summary="Slugs have doubled and dangling hyphens",
        ask="Article links come out as 'hello--world-' when a title has punctuation or extra spaces. Fix slugify in slugs.py.",
        behaviour="slugs.slugify never returns doubled hyphens and never starts or ends with a hyphen: 'Hello,  World!' gives 'hello-world' and '  --Rock & Roll--  ' gives 'rock-roll'.",
        keywords=["slug", "hyphen"],
        module="slugs.py",
        start='''\
def slugify(title):
    """Turns a title into a lower-case link part."""
    out = []
    for char in title.lower():
        out.append(char if char.isalnum() else "-")
    return "".join(out)
''',
        solution='''\
import re


def slugify(title):
    """Turns a title into a lower-case link part."""
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
''',
        visible='''\
from slugs import slugify


def test_lowercases():
    assert slugify("Hello") == "hello"


def test_single_space_becomes_hyphen():
    assert slugify("hello world") == "hello-world"
''',
        hidden='''\
from slugs import slugify


def test_collapses_runs():
    assert slugify("Hello,  World!") == "hello-world"


def test_strips_ends():
    assert slugify("  --Rock & Roll--  ") == "rock-roll"


def test_keeps_digits():
    assert slugify("Top 10: best of 2026") == "top-10-best-of-2026"


def test_plain_title_unchanged():
    assert slugify("hello world") == "hello-world"
''',
    ),
    dict(
        id="paginate",
        summary="Last page of results is cut short",
        ask="The list endpoint drops the final item on the last page, and page 0 quietly returns the wrong rows. Fix paginate in paging.py.",
        behaviour="paging.paginate(items, page, size) returns the full slice for every page including the last one (page 2 of five items with size 3 gives the last two items), returns an empty list past the end, and raises ValueError when page or size is below 1.",
        keywords=["paginate", "page", "paging"],
        module="paging.py",
        start='''\
def paginate(items, page, size):
    """Returns the items of one page. Pages start at 1."""
    start = (page - 1) * size
    end = min(start + size, len(items) - 1)
    return items[start:end]
''',
        solution='''\
def paginate(items, page, size):
    """Returns the items of one page. Pages start at 1."""
    if page < 1 or size < 1:
        raise ValueError("page and size start at 1")
    start = (page - 1) * size
    return items[start:start + size]
''',
        visible='''\
from paging import paginate


def test_first_page():
    assert paginate([1, 2, 3, 4, 5, 6, 7], 1, 3) == [1, 2, 3]


def test_second_page():
    assert paginate([1, 2, 3, 4, 5, 6, 7], 2, 3) == [4, 5, 6]
''',
        hidden='''\
import pytest
from paging import paginate


def test_last_page_is_complete():
    assert paginate([1, 2, 3, 4, 5], 2, 3) == [4, 5]


def test_exact_fit():
    assert paginate([1, 2, 3, 4], 2, 2) == [3, 4]


def test_past_the_end():
    assert paginate([1, 2, 3], 5, 3) == []


@pytest.mark.parametrize("page,size", [(0, 3), (-1, 3), (1, 0)])
def test_rejects_bad_arguments(page, size):
    with pytest.raises(ValueError):
        paginate([1, 2, 3], page, size)
''',
    ),
    dict(
        id="csvline",
        summary="Commas inside quotes split the field",
        ask="Addresses such as \"12 High St, Leeds\" are split into two columns by the importer. Make split_line in csvline.py respect double quotes.",
        behaviour="csvline.split_line keeps a comma inside double quotes in one field and drops the quotes: 'a,\"b,c\",d' gives ['a', 'b,c', 'd']. A doubled quote inside a quoted field stands for one quote character.",
        keywords=["quote", "split_line", "csv"],
        module="csvline.py",
        start='''\
def split_line(line):
    """Splits one line of comma-separated text into its fields."""
    return [field.strip() for field in line.split(",")]
''',
        solution='''\
def split_line(line):
    """Splits one line of comma-separated text into its fields."""
    fields, current, quoted, i = [], [], False, 0
    while i < len(line):
        char = line[i]
        if quoted:
            if char == '"' and line[i + 1:i + 2] == '"':
                current.append('"')
                i += 1
            elif char == '"':
                quoted = False
            else:
                current.append(char)
        elif char == '"':
            quoted = True
        elif char == ",":
            fields.append("".join(current).strip())
            current = []
        else:
            current.append(char)
        i += 1
    fields.append("".join(current).strip())
    return fields
''',
        visible='''\
from csvline import split_line


def test_plain_fields():
    assert split_line("a,b,c") == ["a", "b", "c"]


def test_strips_spaces():
    assert split_line("a , b") == ["a", "b"]
''',
        hidden='''\
from csvline import split_line


def test_quoted_comma():
    assert split_line('a,"b,c",d') == ["a", "b,c", "d"]


def test_quoted_address():
    assert split_line('1,"12 High St, Leeds",UK') == ["1", "12 High St, Leeds", "UK"]


def test_doubled_quote():
    assert split_line('"say ""hi""",x') == ['say "hi"', "x"]


def test_plain_still_works():
    assert split_line("a,b,c") == ["a", "b", "c"]
''',
    ),
    dict(
        id="semver",
        summary="Version 1.10.0 sorts before 1.9.0",
        ask="The update check tells people on 1.10.0 that 1.9.0 is newer. Fix compare in versions.py.",
        behaviour="versions.compare(a, b) compares the three parts of a version as numbers, so compare('1.10.0', '1.9.0') is 1, compare('2.0.0', '10.0.0') is -1 and equal versions give 0.",
        keywords=["version", "compare", "numer"],
        module="versions.py",
        start='''\
def compare(a, b):
    """Returns -1, 0 or 1 as version a is older than, equal to or newer than b."""
    if a == b:
        return 0
    return -1 if a.split(".") < b.split(".") else 1
''',
        solution='''\
def _parts(version):
    return [int(part) for part in version.split(".")]


def compare(a, b):
    """Returns -1, 0 or 1 as version a is older than, equal to or newer than b."""
    left, right = _parts(a), _parts(b)
    if left == right:
        return 0
    return -1 if left < right else 1
''',
        visible='''\
from versions import compare


def test_equal():
    assert compare("1.2.3", "1.2.3") == 0


def test_newer_patch():
    assert compare("1.2.4", "1.2.3") == 1
''',
        hidden='''\
from versions import compare


def test_two_digit_minor():
    assert compare("1.10.0", "1.9.0") == 1
    assert compare("1.9.0", "1.10.0") == -1


def test_two_digit_major():
    assert compare("2.0.0", "10.0.0") == -1


def test_two_digit_patch():
    assert compare("1.0.12", "1.0.9") == 1


def test_equal():
    assert compare("3.4.5", "3.4.5") == 0
''',
    ),
    dict(
        id="lru",
        summary="Cache evicts entries that were just read",
        ask="Hot entries keep falling out of the session cache. A read should count as a use. Fix LRUCache in cache.py.",
        behaviour="cache.LRUCache.get marks the entry as most recently used, so with capacity 2, after put a, put b, get a, put c the cache still holds a and has dropped b. Putting an existing key again also refreshes it.",
        keywords=["lru", "cache", "evict", "recen"],
        module="cache.py",
        start='''\
class LRUCache:
    """Keeps the most recently used entries, up to a capacity."""

    def __init__(self, capacity):
        self.capacity = capacity
        self._data = {}

    def get(self, key, default=None):
        return self._data.get(key, default)

    def put(self, key, value):
        if key not in self._data and len(self._data) >= self.capacity:
            oldest = next(iter(self._data))
            del self._data[oldest]
        self._data[key] = value

    def __contains__(self, key):
        return key in self._data

    def __len__(self):
        return len(self._data)
''',
        solution='''\
class LRUCache:
    """Keeps the most recently used entries, up to a capacity."""

    def __init__(self, capacity):
        self.capacity = capacity
        self._data = {}

    def get(self, key, default=None):
        if key not in self._data:
            return default
        value = self._data.pop(key)
        self._data[key] = value
        return value

    def put(self, key, value):
        if key in self._data:
            del self._data[key]
        elif len(self._data) >= self.capacity:
            oldest = next(iter(self._data))
            del self._data[oldest]
        self._data[key] = value

    def __contains__(self, key):
        return key in self._data

    def __len__(self):
        return len(self._data)
''',
        visible='''\
from cache import LRUCache


def test_stores_and_reads():
    cache = LRUCache(2)
    cache.put("a", 1)
    assert cache.get("a") == 1


def test_evicts_when_full():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    assert len(cache) == 2
    assert "c" in cache
''',
        hidden='''\
from cache import LRUCache


def test_read_refreshes():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    assert cache.get("a") == 1
    cache.put("c", 3)
    assert "a" in cache
    assert "b" not in cache


def test_put_again_refreshes():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("a", 10)
    cache.put("c", 3)
    assert cache.get("a") == 10
    assert "b" not in cache


def test_missing_key_gives_default():
    assert LRUCache(1).get("nope", 7) == 7


def test_plain_eviction_order():
    cache = LRUCache(2)
    cache.put("a", 1)
    cache.put("b", 2)
    cache.put("c", 3)
    assert "a" not in cache
''',
    ),
    dict(
        id="money",
        summary="Split bills lose a cent",
        ask="Splitting 1.00 three ways bills 0.33 three times and one cent goes missing. Fix split_amount in money.py so the shares add up.",
        behaviour="money.split_amount(cents, parts) returns shares that always add up to the total, with the left-over cents given one each to the first shares: split_amount(100, 3) is [34, 33, 33]. It raises ValueError when parts is below 1.",
        keywords=["split", "cent", "remainder", "share"],
        module="money.py",
        start='''\
def split_amount(cents, parts):
    """Splits an amount in cents into equal shares."""
    return [cents // parts] * parts
''',
        solution='''\
def split_amount(cents, parts):
    """Splits an amount in cents into shares that add up to the amount."""
    if parts < 1:
        raise ValueError("parts starts at 1")
    share, left = divmod(cents, parts)
    return [share + 1 if index < left else share for index in range(parts)]
''',
        visible='''\
from money import split_amount


def test_even_split():
    assert split_amount(90, 3) == [30, 30, 30]


def test_one_part():
    assert split_amount(55, 1) == [55]
''',
        hidden='''\
import pytest
from money import split_amount


def test_remainder_goes_to_first():
    assert split_amount(100, 3) == [34, 33, 33]


def test_two_left_over():
    assert split_amount(101, 3) == [34, 34, 33]


@pytest.mark.parametrize("cents,parts", [(100, 3), (1, 4), (999, 7), (0, 2)])
def test_shares_add_up(cents, parts):
    shares = split_amount(cents, parts)
    assert sum(shares) == cents
    assert len(shares) == parts


def test_rejects_zero_parts():
    with pytest.raises(ValueError):
        split_amount(100, 0)
''',
    ),
    dict(
        id="intervals",
        summary="Bookings that touch are shown as separate blocks",
        ask="The calendar draws 9 to 10 and 10 to 11 as two blocks, and gets confused when bookings arrive out of order. Fix merge in intervals.py.",
        behaviour="intervals.merge joins intervals that overlap or touch, whatever order they arrive in: merge([(5, 7), (1, 3), (3, 4)]) is [(1, 4), (5, 7)], and an interval inside another disappears into it.",
        keywords=["merge", "interval", "overlap", "touch"],
        module="intervals.py",
        start='''\
def merge(intervals):
    """Joins overlapping (start, end) intervals."""
    merged = []
    for start, end in intervals:
        if merged and start < merged[-1][1]:
            merged[-1] = (merged[-1][0], end)
        else:
            merged.append((start, end))
    return merged
''',
        solution='''\
def merge(intervals):
    """Joins (start, end) intervals that overlap or touch."""
    merged = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
''',
        visible='''\
from intervals import merge


def test_overlapping():
    assert merge([(1, 3), (2, 5)]) == [(1, 5)]


def test_apart():
    assert merge([(1, 2), (4, 5)]) == [(1, 2), (4, 5)]
''',
        hidden='''\
from intervals import merge


def test_touching():
    assert merge([(9, 10), (10, 11)]) == [(9, 11)]


def test_out_of_order():
    assert merge([(5, 7), (1, 3), (3, 4)]) == [(1, 4), (5, 7)]


def test_contained():
    assert merge([(1, 10), (2, 3)]) == [(1, 10)]


def test_empty():
    assert merge([]) == []
''',
    ),
    dict(
        id="truncate",
        summary="Truncated titles overflow the card",
        ask="Card titles are cut to 20 characters and then get three dots added, so they are 23 wide and wrap. Fix truncate in text.py.",
        behaviour="text.truncate(value, width) never returns more than width characters: a longer value is cut so that the result with its '...' ending is exactly width long, a value that fits is returned unchanged, and a width below 4 raises ValueError.",
        keywords=["truncate", "width", "ellipsis", "dots"],
        module="text.py",
        start='''\
def truncate(value, width):
    """Shortens a value to a width and marks the cut with three dots."""
    if len(value) < width:
        return value
    return value[:width] + "..."
''',
        solution='''\
def truncate(value, width):
    """Shortens a value to a width, three dots included."""
    if width < 4:
        raise ValueError("width starts at 4")
    if len(value) <= width:
        return value
    return value[:width - 3] + "..."
''',
        visible='''\
from text import truncate


def test_short_value_is_kept():
    assert truncate("hi", 10) == "hi"


def test_long_value_gets_dots():
    assert truncate("a long title for a card", 10).endswith("...")
''',
        hidden='''\
import pytest
from text import truncate


def test_result_fits_width():
    assert truncate("abcdefghijklmnop", 10) == "abcdefg..."


def test_exact_fit_unchanged():
    assert truncate("abcdefghij", 10) == "abcdefghij"


def test_short_unchanged():
    assert truncate("abc", 10) == "abc"


@pytest.mark.parametrize("width", [4, 7, 12])
def test_never_wider(width):
    assert len(truncate("x" * 50, width)) == width


def test_rejects_tiny_width():
    with pytest.raises(ValueError):
        truncate("abcdef", 3)
''',
    ),
    dict(
        id="roman",
        summary="Chapter four prints as IIII",
        ask="The table of contents numbers chapters IIII, VIIII and XXXX. Use the usual subtractive forms in to_roman in roman.py.",
        behaviour="roman.to_roman uses subtractive forms: 4 is 'IV', 9 is 'IX', 40 is 'XL', 90 is 'XC', 400 is 'CD', 900 is 'CM' and 1994 is 'MCMXCIV'. It raises ValueError outside 1 to 3999.",
        keywords=["roman", "subtractive", "numeral"],
        module="roman.py",
        start='''\
_VALUES = [(1000, "M"), (500, "D"), (100, "C"), (50, "L"), (10, "X"), (5, "V"), (1, "I")]


def to_roman(number):
    """Writes a whole number as a Roman numeral."""
    out = []
    for value, letter in _VALUES:
        while number >= value:
            out.append(letter)
            number -= value
    return "".join(out)
''',
        solution='''\
_VALUES = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
    (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]


def to_roman(number):
    """Writes a whole number from 1 to 3999 as a Roman numeral."""
    if not 1 <= number <= 3999:
        raise ValueError("number must be between 1 and 3999")
    out = []
    for value, letters in _VALUES:
        while number >= value:
            out.append(letters)
            number -= value
    return "".join(out)
''',
        visible='''\
from roman import to_roman


def test_small_numbers():
    assert to_roman(3) == "III"
    assert to_roman(6) == "VI"


def test_large_number():
    assert to_roman(2000) == "MM"
''',
        hidden='''\
import pytest
from roman import to_roman


@pytest.mark.parametrize("number,text", [(4, "IV"), (9, "IX"), (40, "XL"), (90, "XC"), (400, "CD"), (900, "CM")])
def test_subtractive(number, text):
    assert to_roman(number) == text


def test_year():
    assert to_roman(1994) == "MCMXCIV"


def test_additive_still_works():
    assert to_roman(8) == "VIII"


@pytest.mark.parametrize("number", [0, -3, 4000])
def test_rejects_out_of_range(number):
    with pytest.raises(ValueError):
        to_roman(number)
''',
    ),
]
