def normalize(path):
    """A slash-separated path in its shortest form. See TASK.md."""
    absolute = path.startswith("/")
    kept = []
    for segment in path.split("/"):
        if segment in ("", "."):
            continue
        if segment == "..":
            if kept and kept[-1] != "..":
                kept.pop()
            elif not absolute:
                kept.append("..")
        else:
            kept.append(segment)
    if absolute:
        return "/" + "/".join(kept)
    return "/".join(kept) or "."


def join(base, *parts):
    """`base` with each part applied, normalised. See TASK.md."""
    path = base
    for part in parts:
        if part.startswith("/"):
            path = part
        elif part:
            path = path + "/" + part if path else part
    return normalize(path)
