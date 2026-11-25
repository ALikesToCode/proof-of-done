import re
from itertools import groupby

_TOKEN = re.compile(r"([0-9]*)([^0-9])?", re.DOTALL)


def encode(text):
    """Run-length encode text that holds no digits. See TASK.md."""
    if re.search(r"[0-9]", text):
        raise ValueError("the text must not contain digits")
    parts = []
    for character, run in groupby(text):
        length = len(list(run))
        parts.append(character if length == 1 else f"{length}{character}")
    return "".join(parts)


def decode(text):
    """Reverse `encode`. See TASK.md."""
    parts = []
    position = 0
    while position < len(text):
        count, character = _TOKEN.match(text, position).groups()
        if character is None:
            raise ValueError("a count with no character after it")
        if count and (count.startswith("0") or int(count) < 2):
            raise ValueError(f"invalid count {count!r}")
        parts.append(character * (int(count) if count else 1))
        position += len(count) + 1
    return "".join(parts)
