def _key(version):
    """The sort key of a version: its numbers, whether it is a release, and its tag."""
    if not isinstance(version, str):
        raise TypeError("a version is text")
    core, hyphen, tag = version.partition("-")
    numbers = [int(part) for part in core.split(".")]
    if len(numbers) != 3:
        raise ValueError(f"not a version: {version!r}")
    return numbers, not hyphen, tag


def compare(a, b):
    """Returns -1, 0 or 1 as version a is older than, equal to or newer than b."""
    left, right = _key(a), _key(b)
    if left == right:
        return 0
    return -1 if left < right else 1
