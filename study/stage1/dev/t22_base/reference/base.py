_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz"


def _check(base):
    if isinstance(base, bool) or not isinstance(base, int) or not 2 <= base <= 36:
        raise ValueError("base must be from 2 to 36")


def to_base(number, base):
    _check(base)
    if number == 0:
        return "0"
    digits = []
    left = abs(number)
    while left:
        left, digit = divmod(left, base)
        digits.append(_DIGITS[digit])
    return ("-" if number < 0 else "") + "".join(reversed(digits))


def from_base(text, base):
    _check(base)
    body = text[1:] if text.startswith("-") else text
    if not body:
        raise ValueError("no digits")
    value = 0
    for char in body.lower():
        digit = _DIGITS.find(char)
        if digit < 0 or digit >= base:
            raise ValueError(f"not a digit in base {base}: {char!r}")
        value = value * base + digit
    return -value if text.startswith("-") else value
