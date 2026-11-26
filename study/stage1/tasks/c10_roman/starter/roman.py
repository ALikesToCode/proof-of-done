_VALUES = [(1000, "M"), (500, "D"), (100, "C"), (50, "L"), (10, "X"), (5, "V"), (1, "I")]


def to_roman(number):
    """Writes a whole number as a Roman numeral."""
    out = []
    for value, letter in _VALUES:
        while number >= value:
            out.append(letter)
            number -= value
    return "".join(out)
