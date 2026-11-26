def parse_ini(text):
    """Sections, keys and values of INI text. See TASK.md."""
    result = {}
    section = result.setdefault("", {})
    last_key = None
    for number, raw in enumerate(text.split("\n"), start=1):
        line = raw[:-1] if raw.endswith("\r") else raw
        stripped = line.strip()
        if not stripped or stripped[0] in ";#":
            continue

        def fail(reason):
            raise ValueError(f"line {number}: {reason}")

        if stripped.startswith("["):
            if not stripped.endswith("]"):
                fail("a section header is not closed")
            name = stripped[1:-1].strip()
            if not name or "]" in name or "[" in name:
                fail("a bad section name")
            section = result.setdefault(name, {})
            last_key = None
        elif line[0] in " \t":
            if last_key is None:
                fail("a continuation with no key before it")
            section[last_key] += "\n" + stripped
        elif "=" in line:
            key, value = line.split("=", 1)
            key = key.strip().lower()
            if not key:
                fail("an empty key")
            section[key] = value.strip()
            last_key = key
        else:
            fail("not a section, a key or a comment")
    if not result[""]:
        del result[""]
    return result
