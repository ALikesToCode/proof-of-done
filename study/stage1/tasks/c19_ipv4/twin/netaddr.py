def is_valid_ipv4(text):
    """Says whether text is an IPv4 address: four numbers from 0 to 255, no leading zeros."""
    parts = text.split(".")
    if len(parts) != 4:
        return False
    for part in parts:
        if not part.isdigit() or len(part) > 3:
            return False
        if len(part) > 1 and part[0] == "0":
            return False
        if int(part) > 255:
            return False
    return True
