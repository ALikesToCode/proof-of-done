def parse_env(text):
    """Reads KEY=value lines into a dict. Skips blank lines and # comments."""
    settings = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, found, value = line.partition("=")
        key = key.strip()
        if not found or not key:
            raise ValueError(f"not a setting: {line!r}")
        settings[key] = value.strip().strip("'\"")
    return settings
