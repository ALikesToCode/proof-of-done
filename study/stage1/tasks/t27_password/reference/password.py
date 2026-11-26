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
    if any(password[index] == password[index + 1] == password[index + 2] for index in range(len(password) - 2)):
        found.append("repeated")
    if len(username) >= 3 and username.lower() in password.lower():
        found.append("contains_username")
    return found
