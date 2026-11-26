def is_valid_ipv4(text):
    """Says whether text is an IPv4 address."""
    parts = text.split(".")
    if len(parts) != 4:
        return False
    try:
        return all(int(part) >= 0 for part in parts)
    except ValueError:
        return False
