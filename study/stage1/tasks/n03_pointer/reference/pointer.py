import re

_BAD_ESCAPE = re.compile(r"~(?![01])")
_ESCAPE = re.compile(r"~[01]")
_INDEX = re.compile(r"0|[1-9][0-9]*")


def _decode(token):
    if _BAD_ESCAPE.search(token):
        raise ValueError(f"bad escape in token {token!r}")
    return _ESCAPE.sub(lambda match: "/" if match.group() == "~1" else "~", token)


def resolve(document, pointer):
    """The value inside `document` that the JSON pointer names. See TASK.md."""
    if not isinstance(pointer, str):
        raise TypeError("a pointer is a string")
    if pointer == "":
        return document
    if not pointer.startswith("/"):
        raise ValueError(f"a pointer starts with '/': {pointer!r}")
    current = document
    for token in pointer[1:].split("/"):
        token = _decode(token)
        if isinstance(current, dict):
            current = current[token]
        elif isinstance(current, list):
            if not _INDEX.fullmatch(token):
                raise ValueError(f"not a list index: {token!r}")
            current = current[int(token)]
        else:
            raise TypeError(f"cannot apply {token!r} to a {type(current).__name__}")
    return current
