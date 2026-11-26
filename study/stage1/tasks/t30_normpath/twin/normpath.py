def normalize(path):
    absolute = path.startswith("/")
    kept = []
    for segment in path.split("/"):
        if segment in ("", "."):
            continue
        if segment == ".." and kept:
            kept.pop()
        elif segment != "..":
            kept.append(segment)
    return ("/" if absolute else "") + "/".join(kept)


def join(base, *parts):
    return normalize("/".join((base,) + parts))
