import re

_DURATION = re.compile(r"(?:([0-9]+)h)?(?:([0-9]+)m)?(?:([0-9]+)s)?")


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
    match = _DURATION.fullmatch(stripped)
    if not stripped or match is None:
        raise ValueError(f"not a duration: {text!r}")
    hours, minutes, seconds = (int(number or 0) for number in match.groups())
    return hours * 3600 + minutes * 60 + seconds
