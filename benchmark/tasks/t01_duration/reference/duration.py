import re
from decimal import ROUND_HALF_UP, Decimal

_UNITS = {"w": 604800000, "d": 86400000, "h": 3600000, "m": 60000, "s": 1000, "ms": 1}
_ORDER = ["w", "d", "h", "m", "s", "ms"]
_COMPONENT = re.compile(r"([0-9]+)(?:\.([0-9]+))?(ms|[wdhms])")


def parse_duration(text):
    """Return the duration described by `text` in whole milliseconds. See TASK.md."""
    if not isinstance(text, str):
        raise TypeError("a duration is a string")
    rest = text.strip()
    negative = rest.startswith("-")
    if negative:
        rest = rest[1:]
    if not rest:
        raise ValueError("empty duration")
    position = 0
    last_rank = -1
    total = Decimal(0)
    seen_fraction = False
    while position < len(rest):
        match = _COMPONENT.match(rest, position)
        if match is None or seen_fraction:
            raise ValueError(f"invalid duration: {text!r}")
        whole, fraction, unit = match.groups()
        rank = _ORDER.index(unit)
        if rank <= last_rank:
            raise ValueError(f"units out of order in {text!r}")
        last_rank = rank
        seen_fraction = fraction is not None
        total += Decimal(whole + ("." + fraction if fraction else "")) * _UNITS[unit]
        position = match.end()
        if position < len(rest) and rest[position] == " ":
            position += 1
    result = int(total.quantize(Decimal(1), rounding=ROUND_HALF_UP))
    return -result if negative else result
