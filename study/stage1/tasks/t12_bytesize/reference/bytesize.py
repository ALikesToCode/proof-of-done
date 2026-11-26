import re
from decimal import ROUND_HALF_UP, Decimal

_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"]
_TEXT = re.compile(r"(-?)([0-9]+)(?:\.([0-9]+))?[ ]*(B|KiB|MiB|GiB|TiB)")


def format_size(count):
    """A byte count as text with a binary unit. See TASK.md."""
    if isinstance(count, bool) or not isinstance(count, int):
        raise TypeError("count must be an int")
    sign = "-" if count < 0 else ""
    size = abs(count)
    if size < 1024:
        return f"{sign}{size} B"
    index = 0
    while index < len(_UNITS) - 1 and size >= 1024 ** (index + 1):
        index += 1
    rounded = (Decimal(size) / Decimal(1024 ** index)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    if rounded >= 1024 and index < len(_UNITS) - 1:
        index += 1
        rounded = Decimal("1.0")
    return f"{sign}{rounded} {_UNITS[index]}"


def parse_size(text):
    """The byte count that a size text stands for. See TASK.md."""
    match = _TEXT.fullmatch(text.strip(" "))
    if match is None:
        raise ValueError(f"not a size: {text!r}")
    sign, whole, fraction, unit = match.groups()
    if unit == "B" and fraction is not None:
        raise ValueError("a byte count has no fraction")
    value = Decimal(whole + ("." + fraction if fraction else "")) * 1024 ** _UNITS.index(unit)
    if value != value.to_integral_value():
        raise ValueError("not a whole number of bytes")
    return -int(value) if sign else int(value)
