def parse_env(text):
    """Reads KEY=value lines into a dict."""
    settings = {}
    for line in text.splitlines():
        if not line:
            continue
        key, value = line.split("=")[0], line.split("=")[-1]
        settings[key.strip()] = value.strip()
    return settings
