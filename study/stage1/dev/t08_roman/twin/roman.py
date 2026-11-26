_PAIRS = [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
          (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
_VALUES = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}


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


def from_roman(text):
    """The int for a standard Roman numeral."""
    if not text or any(character not in _VALUES for character in text):
        raise ValueError(f"not a Roman numeral: {text!r}")
    total = 0
    for character, following in zip(text, text[1:] + text[-1]):
        value = _VALUES[character]
        if value < _VALUES[following]:
            total -= value
        else:
            total += value
    if not 1 <= total <= 3999:
        raise ValueError(f"not a Roman numeral: {text!r}")
    return total
