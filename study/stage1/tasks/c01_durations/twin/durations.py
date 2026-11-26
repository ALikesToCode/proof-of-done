import re

_UNITS = {"h": 3600, "m": 60, "s": 1}
_PART = re.compile(r"([0-9]+)([hms])")


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
    if not isinstance(text, str):
        raise TypeError("a duration is text")
    stripped = text.strip()
    if not re.fullmatch(r"(?:[0-9]+[hms])+", stripped):
        raise ValueError(f"not a duration: {text!r}")
    return sum(int(number) * _UNITS[unit] for number, unit in _PART.findall(stripped))
