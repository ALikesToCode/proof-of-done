def parse_env(text):
    """Reads KEY=value lines into a dict. See TASK.md."""
    settings = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, found, value = line.partition("=")
        key = key.strip()
        if not found or not key:
            raise ValueError(f"not a setting: {line!r}")
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]
        settings[key] = value
    return settings
