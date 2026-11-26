_VALUES = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
    (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]


def to_roman(number):
    """Writes a whole number from 1 to 3999 as a Roman numeral."""
    if isinstance(number, bool) or not isinstance(number, int):
        raise TypeError("number must be an int")
    if not 1 <= number <= 3999:
        raise ValueError("number must be between 1 and 3999")
    out = []
    for value, letters in _VALUES:
        while number >= value:
            out.append(letters)
            number -= value
    return "".join(out)
