def split_amount(cents, parts):
    """Splits an amount in cents into equal shares."""
    return [cents // parts] * parts
