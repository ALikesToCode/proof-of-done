import re

_PATH = re.compile(r"[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*")
_MISSING = object()


def _lookup(path, values):
    current = values
    for name in path.split("."):
        if isinstance(current, dict):
            if name not in current:
                return _MISSING
            current = current[name]
        elif isinstance(current, (list, tuple)) and name.isdigit() and name.isascii():
            index = int(name)
            if index >= len(current):
                return _MISSING
            current = current[index]
        else:
            return _MISSING
    return current


def _show(value):
    if value is None:
        return ""
    if value is True:
        return "true"
    if value is False:
        return "false"
    return str(value)


def render(template, values):
    """The template with its fields filled from `values`. See TASK.md."""
    out = []
    index = 0
    while index < len(template):
        char = template[index]
        if template.startswith("{{", index):
            out.append("{")
            index += 2
        elif template.startswith("}}", index):
            out.append("}")
            index += 2
        elif char == "}":
            raise ValueError("a } with no opening {")
        elif char == "{":
            end = template.find("}", index)
            if end < 0:
                raise ValueError("a { with no closing }")
            body = template[index + 1:end]
            if "{" in body:
                raise ValueError("a { inside a field")
            path, bar, default = body.partition("|")
            path = path.strip()
            if not _PATH.fullmatch(path):
                raise ValueError(f"not a valid path: {path!r}")
            value = _lookup(path, values)
            if value is _MISSING:
                if not bar:
                    raise KeyError(path)
                out.append(default)
            else:
                out.append(_show(value))
            index = end + 1
        else:
            out.append(char)
            index += 1
    return "".join(out)
