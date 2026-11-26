"""Tasks 11 to 20. Same shape as catalog_a.py."""

TASKS_B = [
    dict(
        id="workdays",
        summary="Delivery estimates count weekends",
        ask="Estimates promise delivery on a Sunday. Make working_days_between in workdays.py skip Saturdays and Sundays.",
        behaviour="workdays.working_days_between(start, end) counts the days from start up to but not including end that fall on Monday to Friday: Friday 6 Nov 2026 to Monday 9 Nov 2026 is 1, and a full week is 5. It raises ValueError when end is before start.",
        keywords=["weekend", "working", "workday", "saturday"],
        module="workdays.py",
        start='''\
from datetime import date


def working_days_between(start: date, end: date) -> int:
    """Counts the working days from start up to, but not including, end."""
    return (end - start).days
''',
        solution='''\
from datetime import date, timedelta


def working_days_between(start: date, end: date) -> int:
    """Counts the days from Monday to Friday from start up to, but not including, end."""
    if end < start:
        raise ValueError("end is before start")
    count = 0
    day = start
    while day < end:
        if day.weekday() < 5:
            count += 1
        day += timedelta(days=1)
    return count
''',
        visible='''\
from datetime import date

from workdays import working_days_between


def test_same_day_is_zero():
    assert working_days_between(date(2026, 11, 2), date(2026, 11, 2)) == 0


def test_within_one_week():
    assert working_days_between(date(2026, 11, 2), date(2026, 11, 5)) == 3
''',
        hidden='''\
from datetime import date

import pytest
from workdays import working_days_between


def test_skips_the_weekend():
    assert working_days_between(date(2026, 11, 6), date(2026, 11, 9)) == 1


def test_full_week():
    assert working_days_between(date(2026, 11, 2), date(2026, 11, 9)) == 5


def test_weekend_only():
    assert working_days_between(date(2026, 11, 7), date(2026, 11, 9)) == 0


def test_two_weeks():
    assert working_days_between(date(2026, 11, 2), date(2026, 11, 16)) == 10


def test_rejects_reversed():
    with pytest.raises(ValueError):
        working_days_between(date(2026, 11, 9), date(2026, 11, 2))
''',
    ),
    dict(
        id="envfile",
        summary="Settings file comments break the loader",
        ask="A commented line in the settings file ends up as a setting named '# database', and quoted values keep their quotes. Fix parse_env in envfile.py.",
        behaviour="envfile.parse_env skips blank lines and lines that start with '#', strips one pair of matching single or double quotes from a value, and keeps any '=' after the first one in the value: 'URL=\"a=b\"' gives {'URL': 'a=b'}.",
        keywords=["comment", "quote", "parse_env", "env"],
        module="envfile.py",
        start='''\
def parse_env(text):
    """Reads KEY=value lines into a dict."""
    settings = {}
    for line in text.splitlines():
        if not line:
            continue
        key, value = line.split("=")[0], line.split("=")[-1]
        settings[key.strip()] = value.strip()
    return settings
''',
        solution='''\
def parse_env(text):
    """Reads KEY=value lines into a dict. Skips blank lines and # comments."""
    settings = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\\"":
            value = value[1:-1]
        settings[key.strip()] = value
    return settings
''',
        visible='''\
from envfile import parse_env


def test_reads_pairs():
    assert parse_env("A=1\\nB=two") == {"A": "1", "B": "two"}


def test_skips_empty_lines():
    assert parse_env("A=1\\n\\nB=2") == {"A": "1", "B": "2"}
''',
        hidden='''\
from envfile import parse_env


def test_skips_comments():
    assert parse_env("# database\\nHOST=db") == {"HOST": "db"}


def test_strips_double_quotes():
    assert parse_env('NAME="my app"') == {"NAME": "my app"}


def test_strips_single_quotes():
    assert parse_env("NAME='my app'") == {"NAME": "my app"}


def test_keeps_later_equals():
    assert parse_env('URL="a=b"') == {"URL": "a=b"}
    assert parse_env("TOKEN=abc=def") == {"TOKEN": "abc=def"}


def test_blank_and_spaces():
    assert parse_env("  \\n  A = 1  \\n") == {"A": "1"}
''',
    ),
    dict(
        id="bucket",
        summary="Rate limit never lets anyone back in",
        ask="Once a client uses up its requests it stays blocked for ever. The bucket should fill again over time. Fix TokenBucket in bucket.py.",
        behaviour="bucket.TokenBucket(capacity, per_second).allow(now) refills per_second tokens for each second that passed since the last call, never above capacity: with capacity 2 and one token per second, two calls at t=0 pass, a third at t=0 fails, and a call at t=1 passes again.",
        keywords=["refill", "bucket", "token", "rate"],
        module="bucket.py",
        start='''\
class TokenBucket:
    """Allows a call while tokens are left."""

    def __init__(self, capacity, per_second):
        self.capacity = capacity
        self.per_second = per_second
        self.tokens = capacity

    def allow(self, now):
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
''',
        solution='''\
class TokenBucket:
    """Allows a call while tokens are left, and refills them over time."""

    def __init__(self, capacity, per_second):
        self.capacity = capacity
        self.per_second = per_second
        self.tokens = capacity
        self.last = None

    def allow(self, now):
        if self.last is not None and now > self.last:
            self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.per_second)
        self.last = now
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False
''',
        visible='''\
from bucket import TokenBucket


def test_allows_up_to_capacity():
    bucket = TokenBucket(2, 1)
    assert bucket.allow(0) is True
    assert bucket.allow(0) is True


def test_blocks_when_empty():
    bucket = TokenBucket(1, 1)
    bucket.allow(0)
    assert bucket.allow(0) is False
''',
        hidden='''\
from bucket import TokenBucket


def test_refills_after_a_second():
    bucket = TokenBucket(2, 1)
    assert bucket.allow(0) and bucket.allow(0)
    assert bucket.allow(0) is False
    assert bucket.allow(1) is True


def test_refill_is_capped():
    bucket = TokenBucket(2, 1)
    bucket.allow(0)
    bucket.allow(0)
    assert bucket.allow(100) is True
    assert bucket.allow(100) is True
    assert bucket.allow(100) is False


def test_partial_refill_is_not_enough():
    bucket = TokenBucket(1, 1)
    bucket.allow(0)
    assert bucket.allow(0.5) is False
    assert bucket.allow(1.0) is True


def test_faster_rate():
    bucket = TokenBucket(4, 2)
    for _ in range(4):
        assert bucket.allow(0)
    assert bucket.allow(0) is False
    assert bucket.allow(1) and bucket.allow(1)
    assert bucket.allow(1) is False
''',
    ),
    dict(
        id="transpose",
        summary="Wide tables lose columns when flipped",
        ask="Flipping a table with two rows and three columns drops the third column. Fix transpose in grid.py, and refuse tables whose rows differ in length.",
        behaviour="grid.transpose works for tables that are not square: [[1, 2, 3], [4, 5, 6]] gives [[1, 4], [2, 5], [3, 6]]. An empty table gives an empty table, and rows of different lengths raise ValueError.",
        keywords=["transpose", "square", "ragged", "column"],
        module="grid.py",
        start='''\
def transpose(rows):
    """Turns the rows of a table into its columns."""
    size = len(rows)
    return [[rows[r][c] for r in range(size)] for c in range(size)]
''',
        solution='''\
def transpose(rows):
    """Turns the rows of a table into its columns."""
    if not rows:
        return []
    width = len(rows[0])
    if any(len(row) != width for row in rows):
        raise ValueError("rows differ in length")
    return [[row[c] for row in rows] for c in range(width)]
''',
        visible='''\
from grid import transpose


def test_square():
    assert transpose([[1, 2], [3, 4]]) == [[1, 3], [2, 4]]


def test_single_cell():
    assert transpose([[7]]) == [[7]]
''',
        hidden='''\
import pytest
from grid import transpose


def test_wide():
    assert transpose([[1, 2, 3], [4, 5, 6]]) == [[1, 4], [2, 5], [3, 6]]


def test_tall():
    assert transpose([[1], [2], [3]]) == [[1, 2, 3]]


def test_empty():
    assert transpose([]) == []


def test_ragged():
    with pytest.raises(ValueError):
        transpose([[1, 2], [3]])
''',
    ),
    dict(
        id="unique",
        summary="Removing duplicates shuffles the list",
        ask="After duplicates are removed the recently-viewed list comes back in a random order. Keep the first-seen order in unique in dedupe.py, and let callers pass a key.",
        behaviour="dedupe.unique(items, key=None) keeps the first of each duplicate in its original position: unique([3, 1, 3, 2, 1]) is [3, 1, 2]. With a key function, items count as duplicates when their keys are equal: unique(['a', 'A', 'b'], key=str.lower) is ['a', 'b'].",
        keywords=["order", "unique", "duplicate", "key"],
        module="dedupe.py",
        start='''\
def unique(items):
    """Removes duplicates from a list."""
    return sorted(set(items))
''',
        solution='''\
def unique(items, key=None):
    """Removes duplicates and keeps the first of each in its place."""
    seen = set()
    out = []
    for item in items:
        marker = key(item) if key else item
        if marker not in seen:
            seen.add(marker)
            out.append(item)
    return out
''',
        visible='''\
from dedupe import unique


def test_removes_duplicates():
    assert unique([1, 1, 2]) == [1, 2]


def test_empty():
    assert unique([]) == []
''',
        hidden='''\
from dedupe import unique


def test_keeps_first_seen_order():
    assert unique([3, 1, 3, 2, 1]) == [3, 1, 2]


def test_strings_keep_order():
    assert unique(["pear", "apple", "pear"]) == ["pear", "apple"]


def test_key():
    assert unique(["a", "A", "b"], key=str.lower) == ["a", "b"]


def test_key_on_records():
    rows = [{"id": 2, "n": "x"}, {"id": 1, "n": "y"}, {"id": 2, "n": "z"}]
    assert unique(rows, key=lambda row: row["id"]) == rows[:2]
''',
    ),
    dict(
        id="account",
        summary="Accounts can be overdrawn",
        ask="A withdrawal larger than the balance goes through and leaves a negative balance. Refuse it in Account.withdraw in account.py.",
        behaviour="account.Account.withdraw raises account.InsufficientFunds and leaves the balance unchanged when the amount is larger than the balance. Withdrawing the whole balance is allowed, and an amount of zero or less raises ValueError.",
        keywords=["withdraw", "overdra", "insufficient", "balance"],
        module="account.py",
        start='''\
class Account:
    """A balance in cents."""

    def __init__(self, balance=0):
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        self.balance -= amount
        return self.balance
''',
        solution='''\
class InsufficientFunds(Exception):
    """The withdrawal is larger than the balance."""


class Account:
    """A balance in cents."""

    def __init__(self, balance=0):
        self.balance = balance

    def deposit(self, amount):
        self.balance += amount
        return self.balance

    def withdraw(self, amount):
        if amount <= 0:
            raise ValueError("amount must be positive")
        if amount > self.balance:
            raise InsufficientFunds(f"balance is {self.balance}, asked for {amount}")
        self.balance -= amount
        return self.balance
''',
        visible='''\
from account import Account


def test_deposit():
    assert Account(100).deposit(50) == 150


def test_withdraw_within_balance():
    assert Account(100).withdraw(40) == 60
''',
        hidden='''\
import pytest
import account
from account import Account


def test_refuses_overdraft():
    acct = Account(100)
    with pytest.raises(account.InsufficientFunds):
        acct.withdraw(101)
    assert acct.balance == 100


def test_whole_balance_is_allowed():
    assert Account(100).withdraw(100) == 0


@pytest.mark.parametrize("amount", [0, -5])
def test_rejects_non_positive(amount):
    acct = Account(100)
    with pytest.raises(ValueError):
        acct.withdraw(amount)
    assert acct.balance == 100


def test_normal_withdrawal():
    assert Account(100).withdraw(40) == 60
''',
    ),
    dict(
        id="kelvin",
        summary="Sensor readings in Kelvin are refused",
        ask="The lab sensors report Kelvin and convert in temperature.py only knows Celsius and Fahrenheit. Add Kelvin, and refuse readings below absolute zero.",
        behaviour="temperature.convert(value, source, target) handles 'K' as well as 'C' and 'F': convert(0, 'C', 'K') is 273.15 and convert(300, 'K', 'C') is about 26.85. A value below absolute zero in its source unit raises ValueError, and so does an unknown unit.",
        keywords=["kelvin", "absolute zero", "temperature"],
        module="temperature.py",
        start='''\
def convert(value, source, target):
    """Converts a temperature between Celsius (C) and Fahrenheit (F)."""
    if source == target:
        return value
    if source == "C" and target == "F":
        return value * 9 / 5 + 32
    if source == "F" and target == "C":
        return (value - 32) * 5 / 9
    raise ValueError(f"cannot convert {source} to {target}")
''',
        solution='''\
_TO_CELSIUS = {
    "C": lambda value: value,
    "F": lambda value: (value - 32) * 5 / 9,
    "K": lambda value: value - 273.15,
}
_FROM_CELSIUS = {
    "C": lambda value: value,
    "F": lambda value: value * 9 / 5 + 32,
    "K": lambda value: value + 273.15,
}


def convert(value, source, target):
    """Converts a temperature between Celsius (C), Fahrenheit (F) and Kelvin (K)."""
    if source not in _TO_CELSIUS or target not in _FROM_CELSIUS:
        raise ValueError(f"cannot convert {source} to {target}")
    celsius = _TO_CELSIUS[source](value)
    if celsius < -273.15 - 1e-9:
        raise ValueError("below absolute zero")
    if source == target:
        return value
    return _FROM_CELSIUS[target](celsius)
''',
        visible='''\
import pytest
from temperature import convert


def test_celsius_to_fahrenheit():
    assert convert(100, "C", "F") == pytest.approx(212)


def test_fahrenheit_to_celsius():
    assert convert(32, "F", "C") == pytest.approx(0)
''',
        hidden='''\
import pytest
from temperature import convert


def test_celsius_to_kelvin():
    assert convert(0, "C", "K") == pytest.approx(273.15)


def test_kelvin_to_celsius():
    assert convert(300, "K", "C") == pytest.approx(26.85)


def test_kelvin_to_fahrenheit():
    assert convert(273.15, "K", "F") == pytest.approx(32)


def test_fahrenheit_to_kelvin():
    assert convert(212, "F", "K") == pytest.approx(373.15)


@pytest.mark.parametrize("value,unit", [(-1, "K"), (-300, "C"), (-500, "F")])
def test_below_absolute_zero(value, unit):
    with pytest.raises(ValueError):
        convert(value, unit, "C" if unit != "C" else "K")


def test_unknown_unit():
    with pytest.raises(ValueError):
        convert(1, "C", "R")
''',
    ),
    dict(
        id="wordfreq",
        summary="Tag cloud counts 'The' and 'the,' separately",
        ask="The tag cloud shows The, the and 'the,' as three words. Make word_counts in wordfreq.py ignore case and punctuation.",
        behaviour="wordfreq.word_counts ignores case and the punctuation around words: word_counts('The cat. the CAT, the dog!') is {'the': 3, 'cat': 2, 'dog': 1}. An apostrophe inside a word stays, so \"don't\" is one word.",
        keywords=["case", "punctuation", "word_counts", "word"],
        module="wordfreq.py",
        start='''\
def word_counts(text):
    """Counts how often each word occurs."""
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts
''',
        solution='''\
import re

_WORD = re.compile(r"[a-z0-9]+(?:'[a-z0-9]+)*")


def word_counts(text):
    """Counts how often each word occurs, ignoring case and punctuation."""
    counts = {}
    for word in _WORD.findall(text.lower()):
        counts[word] = counts.get(word, 0) + 1
    return counts
''',
        visible='''\
from wordfreq import word_counts


def test_counts_words():
    assert word_counts("a b a") == {"a": 2, "b": 1}


def test_empty_text():
    assert word_counts("") == {}
''',
        hidden='''\
from wordfreq import word_counts


def test_ignores_case_and_punctuation():
    assert word_counts("The cat. the CAT, the dog!") == {"the": 3, "cat": 2, "dog": 1}


def test_keeps_inner_apostrophe():
    assert word_counts("Don't stop, don't") == {"don't": 2, "stop": 1}


def test_only_punctuation():
    assert word_counts("... !!! ,") == {}


def test_plain_words():
    assert word_counts("a b a") == {"a": 2, "b": 1}
''',
    ),
    dict(
        id="ipv4",
        summary="Firewall form accepts 999.1.1.1",
        ask="The allow-list form accepts addresses such as 999.1.1.1 and 01.2.3.4. Tighten is_valid_ipv4 in netaddr.py.",
        behaviour="netaddr.is_valid_ipv4 accepts only four dot-separated decimal numbers from 0 to 255 with no leading zeros: '192.168.0.1' and '0.0.0.0' are valid, and '999.1.1.1', '01.2.3.4', '1.2.3', '1.2.3.4.5', '1.2.3.-4' and '1.2.3. 4' are not.",
        keywords=["ipv4", "leading zero", "range", "address", "valid"],
        module="netaddr.py",
        start='''\
def is_valid_ipv4(text):
    """Says whether text is an IPv4 address."""
    parts = text.split(".")
    if len(parts) != 4:
        return False
    try:
        return all(int(part) >= 0 for part in parts)
    except ValueError:
        return False
''',
        solution='''\
def is_valid_ipv4(text):
    """Says whether text is an IPv4 address: four numbers from 0 to 255, no leading zeros."""
    parts = text.split(".")
    if len(parts) != 4:
        return False
    for part in parts:
        if not part.isascii() or not part.isdigit():
            return False
        if len(part) > 1 and part[0] == "0":
            return False
        if int(part) > 255:
            return False
    return True
''',
        visible='''\
from netaddr import is_valid_ipv4


def test_accepts_an_address():
    assert is_valid_ipv4("192.168.0.1") is True


def test_rejects_words():
    assert is_valid_ipv4("not.an.ip.address") is False
''',
        hidden='''\
import pytest
from netaddr import is_valid_ipv4


@pytest.mark.parametrize("text", ["192.168.0.1", "0.0.0.0", "255.255.255.255", "10.0.0.7"])
def test_valid(text):
    assert is_valid_ipv4(text) is True


@pytest.mark.parametrize("text", ["999.1.1.1", "256.0.0.0", "01.2.3.4", "1.2.3", "1.2.3.4.5", "1.2.3.-4", "1.2.3. 4", "1..3.4", ""])
def test_invalid(text):
    assert is_valid_ipv4(text) is False
''',
    ),
    dict(
        id="flatten",
        summary="Menu export flattens too much",
        ask="The menu export needs only the top level of nesting removed, and flatten in nested.py always goes all the way down. Add a depth argument.",
        behaviour="nested.flatten(items, depth=None) removes that many levels of list nesting: flatten([1, [2, [3, [4]]]], depth=1) is [1, 2, [3, [4]]], depth=0 returns a copy unchanged, and depth=None still flattens completely. A negative depth raises ValueError. Strings are never split into characters.",
        keywords=["depth", "flatten", "nest", "level"],
        module="nested.py",
        start='''\
def flatten(items):
    """Flattens nested lists into one list."""
    out = []
    for item in items:
        if isinstance(item, list):
            out.extend(flatten(item))
        else:
            out.append(item)
    return out
''',
        solution='''\
def flatten(items, depth=None):
    """Flattens nested lists, completely or by a number of levels."""
    if depth is not None and depth < 0:
        raise ValueError("depth cannot be negative")
    out = []
    for item in items:
        if isinstance(item, list) and (depth is None or depth > 0):
            out.extend(flatten(item, None if depth is None else depth - 1))
        else:
            out.append(item)
    return out
''',
        visible='''\
from nested import flatten


def test_flattens_completely():
    assert flatten([1, [2, [3, [4]]]]) == [1, 2, 3, 4]


def test_flat_list_unchanged():
    assert flatten([1, 2, 3]) == [1, 2, 3]
''',
        hidden='''\
import pytest
from nested import flatten


def test_one_level():
    assert flatten([1, [2, [3, [4]]]], depth=1) == [1, 2, [3, [4]]]


def test_two_levels():
    assert flatten([1, [2, [3, [4]]]], depth=2) == [1, 2, 3, [4]]


def test_zero_levels():
    assert flatten([1, [2]], depth=0) == [1, [2]]


def test_default_is_complete():
    assert flatten([1, [2, [3, [4]]]]) == [1, 2, 3, 4]
    assert flatten([1, [2, [3]]], depth=None) == [1, 2, 3]


def test_strings_stay_whole():
    assert flatten(["ab", ["cd"]], depth=1) == ["ab", "cd"]


def test_negative_depth():
    with pytest.raises(ValueError):
        flatten([1], depth=-1)
''',
    ),
]
