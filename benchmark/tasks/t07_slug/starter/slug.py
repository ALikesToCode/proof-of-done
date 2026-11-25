"""URL slugs for titles."""
import re
import unicodedata


def slugify(title):
    """Lower-case ASCII words joined by hyphens."""
    text = unicodedata.normalize("NFKD", title)
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return slug or "untitled"
