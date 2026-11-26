def slugify(title):
    """Turns a title into a lower-case link part."""
    out = []
    for char in title.lower():
        out.append(char if char.isalnum() else "-")
    return "".join(out)
