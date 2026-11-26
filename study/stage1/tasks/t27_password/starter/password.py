"""Password rules."""


def problems(password, username=""):
    """Names of the rules the password breaks, in a fixed order."""
    found = []
    if len(password) < 10:
        found.append("too_short")
    if not any(char.islower() for char in password):
        found.append("no_lower")
    if not any(char.isupper() for char in password):
        found.append("no_upper")
    if not any(char in "0123456789" for char in password):
        found.append("no_digit")
    if not any(not char.isalnum() and not char.isspace() for char in password):
        found.append("no_symbol")
    if any(char.isspace() for char in password):
        found.append("has_whitespace")
    return found
