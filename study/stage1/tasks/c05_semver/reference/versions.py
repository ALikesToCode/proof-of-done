import re

_VERSION = re.compile(r"([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z]+))?")


def _key(version):
    """The sort key of a version: its numbers, whether it is a release, and its tag."""
    if not isinstance(version, str):
        raise TypeError("a version is text")
    match = _VERSION.fullmatch(version)
    if match is None:
        raise ValueError(f"not a version: {version!r}")
    major, minor, patch, tag = match.groups()
    return (int(major), int(minor), int(patch)), tag is None, tag or ""


def compare(a, b):
    """Returns -1, 0 or 1 as version a is older than, equal to or newer than b."""
    left, right = _key(a), _key(b)
    if left == right:
        return 0
    return -1 if left < right else 1
