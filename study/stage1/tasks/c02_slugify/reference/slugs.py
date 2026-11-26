import re


def slugify(title):
    """Turns a title into a lower-case link part."""
    if not isinstance(title, str):
        raise TypeError("a title is text")
    text = re.sub(r"['’]", "", title.lower())
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")
