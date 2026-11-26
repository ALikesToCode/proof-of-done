def split_amount(cents, parts):
    """Splits an amount in cents into shares that add up to the amount."""
    if not isinstance(cents, int) or not isinstance(parts, int):
        raise TypeError("cents and parts are whole numbers")
    if parts < 1:
        raise ValueError("parts starts at 1")
    sign = -1 if cents < 0 else 1
    share, left = divmod(abs(cents), parts)
    return [sign * (share + 1 if index < left else share) for index in range(parts)]
