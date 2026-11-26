def _digits(text):
    cleaned = text.replace(" ", "").replace("-", "")
    if not cleaned or any(char not in "0123456789" for char in cleaned):
        return None
    return [int(char) for char in cleaned]


def _total(digits):
    total = 0
    for position, digit in enumerate(reversed(digits)):
        if position % 2 == 1:
            digit *= 2
            if digit > 9:
                digit -= 9
        total += digit
    return total


def is_valid(number):
    digits = _digits(number)
    return digits is not None and len(digits) >= 2 and _total(digits) % 10 == 0


def check_digit(partial):
    digits = _digits(partial) if isinstance(partial, str) else None
    if digits is None:
        raise ValueError("partial must be digits")
    return str((10 - _total(digits + [0]) % 10) % 10)
