def parse_ini(text):
    result = {}
    section = None
    for line in text.splitlines():
        line = line.split(";")[0].split("#")[0].strip()
        if not line:
            continue
        if line.startswith("[") and line.endswith("]"):
            section = result.setdefault(line[1:-1].strip(), {})
        elif "=" in line:
            key, value = line.split("=", 1)
            if section is None:
                section = result.setdefault("", {})
            section[key.strip().lower()] = value.strip()
        else:
            raise ValueError(f"bad line: {line}")
    return result
