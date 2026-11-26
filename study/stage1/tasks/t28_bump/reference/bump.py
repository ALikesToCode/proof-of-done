import re

_VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
_HEAD = re.compile(r"([a-z]+)(\([^()]+\))?(!)?: (.*)")


def _level(message):
    """3 breaking, 2 feature, 1 fix, 0 nothing."""
    lines = message.split("\n")
    match = _HEAD.fullmatch(lines[0])
    if match is None or match.group(4) == "" or match.group(4).startswith(" "):
        return 0
    if match.group(3) or any(line.startswith(("BREAKING CHANGE: ", "BREAKING-CHANGE: ")) for line in lines[1:]):
        return 3
    return {"feat": 2, "fix": 1}.get(match.group(1), 0)


def next_version(current, commits):
    """The version after `current`, decided by the commit messages. See TASK.md."""
    match = _VERSION.fullmatch(current)
    if match is None:
        raise ValueError(f"not a version: {current!r}")
    major, minor, patch = (int(part) for part in match.groups())
    level = max((_level(message) for message in commits), default=0)
    if level == 0:
        return current
    if major == 0:
        return f"0.{minor + 1}.0" if level == 3 else f"0.{minor}.{patch + 1}"
    if level == 3:
        return f"{major + 1}.0.0"
    if level == 2:
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"
