from itertools import groupby


def encode(text):
    """Run-length encode text that holds no digits. See TASK.md."""
    parts = []
    for character, run in groupby(text):
        length = len(list(run))
        parts.append(character if length == 1 else f"{length}{character}")
    return "".join(parts)


def decode(text):
    """Reverse `encode`. See TASK.md."""
    parts = []
    count = ""
    for character in text:
        if character in "0123456789":
            count += character
        else:
            parts.append(character * int(count or 1))
            count = ""
    if count:
        raise ValueError("a count with no character after it")
    return "".join(parts)
