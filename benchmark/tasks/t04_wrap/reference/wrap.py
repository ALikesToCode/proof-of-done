def wrap(text, width, indent=""):
    """Wrap `text` to lines of at most `width` characters. See TASK.md."""
    if not isinstance(width, int) or isinstance(width, bool) or width < 1 or len(indent) >= width:
        raise ValueError("width must be an int of at least 1 and longer than the indent")
    lines = []
    for paragraph in text.split("\n"):
        words = paragraph.split()
        if not words:
            lines.append("")
            continue
        prefix = ""
        current = None
        for word in words:
            while True:
                room = width - len(prefix)
                if current is None:
                    if len(word) <= room:
                        current = word
                        break
                    lines.append(prefix + word[:room])
                    word = word[room:]
                    prefix = indent
                elif len(current) + 1 + len(word) <= room:
                    current += " " + word
                    break
                else:
                    lines.append(prefix + current)
                    current = None
                    prefix = indent
        if current is not None:
            lines.append(prefix + current)
    return lines
