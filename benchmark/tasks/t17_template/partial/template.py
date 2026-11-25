import re


def render(template, values):
    def fill(match):
        path, _, default = match.group(1).partition("|")
        current = values
        try:
            for name in path.strip().split("."):
                current = current[name]
        except (KeyError, TypeError, IndexError):
            if "|" in match.group(1):
                return default
            raise KeyError(path.strip())
        return str(current)

    return re.sub(r"\{([^{}]*)\}", fill, template)
