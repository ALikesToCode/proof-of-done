"""URL slugs for titles."""
import re
import unicodedata


def _shorten(slug, max_length):
    if len(slug) <= max_length:
        return slug
    if slug[max_length] == "-":
        return slug[:max_length]
    cut = slug.rfind("-", 0, max_length)
    return slug[:cut] if cut > 0 else slug[:max_length]


def slugify(title, max_length=None):
    """Lower-case ASCII words joined by hyphens, at most `max_length` characters."""
    if max_length is not None and max_length < 1:
        raise ValueError("max_length must be at least 1")
    text = unicodedata.normalize("NFKD", title)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "untitled"
    return slug if max_length is None else _shorten(slug, max_length)


def unique_slug(title, taken, max_length=None):
    """A slug for `title` that is not in `taken`, with a numeric suffix when needed."""
    slug = slugify(title, max_length)
    if slug not in taken:
        return slug
    full = slugify(title)
    number = 2
    while True:
        suffix = f"-{number}"
        if max_length is None:
            candidate = full + suffix
        else:
            room = max_length - len(suffix)
            if room < 1:
                raise ValueError("max_length leaves no room for the slug")
            candidate = _shorten(full, room) + suffix
        if candidate not in taken:
            return candidate
        number += 1
