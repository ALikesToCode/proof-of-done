"""URL slugs for titles."""
import re
import unicodedata


def slugify(title, max_length=None):
    text = unicodedata.normalize("NFKD", title)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-") or "untitled"
    if max_length is not None and len(slug) > max_length:
        cut = slug[:max_length]
        if "-" in cut:
            cut = cut.rsplit("-", 1)[0]
        slug = cut
    return slug


def unique_slug(title, taken, max_length=None):
    slug = slugify(title, max_length)
    if slug not in taken:
        return slug
    number = 2
    while f"{slug}-{number}" in taken:
        number += 1
    return f"{slug}-{number}"
