_VALUES = [
    (1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"),
    (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I"),
]


def to_roman(number):
    """Writes a whole number as a Roman numeral."""
    if not isinstance(number, int):
        raise TypeError("number must be an int")
    if number < 1:
        raise ValueError("there is no Roman numeral for zero or a negative number")
    out = []
    for value, letters in _VALUES:
        while number >= value:
            out.append(letters)
            number -= value
    return "".join(out)
