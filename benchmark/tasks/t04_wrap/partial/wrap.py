import textwrap


def wrap(text, width, indent=""):
    if width < 1:
        raise ValueError("width")
    return textwrap.wrap(" ".join(text.split()), width, subsequent_indent=indent) or [""]
