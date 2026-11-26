_PAIRS = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
          (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]


def to_roman(number):
    """Roman numeral for an int from 1 to 3999."""
    if not isinstance(number, int) or not 1 <= number <= 3999:
        raise ValueError("number must be from 1 to 3999")
    parts = []
    for value, text in _PAIRS:
        while number >= value:
            parts.append(text)
            number -= value
    return "".join(parts)


_VALUES = {to_roman(number): number for number in range(1, 4000)}


def from_roman(text):
    """The int for a standard Roman numeral."""
    if text not in _VALUES:
        raise ValueError(f"not a standard Roman numeral: {text!r}")
    return _VALUES[text]
