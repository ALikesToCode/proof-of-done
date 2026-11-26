def _compile_segment(segment):
    """A list of items: ('lit', c), ('any',), ('star',), ('set', negated, members, ranges)."""
    items = []
    index = 0
    while index < len(segment):
        char = segment[index]
        if char == "\\":
            if index + 1 >= len(segment):
                raise ValueError("a pattern ends with a backslash")
            items.append(("lit", segment[index + 1]))
            index += 2
        elif char == "?":
            items.append(("any",))
            index += 1
        elif char == "*":
            if not items or items[-1] != ("star",):
                items.append(("star",))
            index += 1
        elif char == "[":
            index += 1
            negated = segment[index:index + 1] == "!"
            if negated:
                index += 1
            members = []
            first = True
            while True:
                if index >= len(segment):
                    raise ValueError("a class is not closed")
                current = segment[index]
                if current == "]" and not first:
                    index += 1
                    break
                first = False
                if segment[index + 1:index + 2] == "-" and index + 2 < len(segment) and segment[index + 2] != "]":
                    low, high = current, segment[index + 2]
                    if high < low:
                        raise ValueError("a range ends before it starts")
                    members.append((low, high))
                    index += 3
                else:
                    members.append((current, current))
                    index += 1
            items.append(("set", negated, tuple(members)))
        else:
            items.append(("lit", char))
            index += 1
    return items


def _segment_matches(items, text):
    def walk(i, j):
        while i < len(items):
            item = items[i]
            if item[0] == "star":
                return any(walk(i + 1, k) for k in range(j, len(text) + 1))
            if j >= len(text):
                return False
            char = text[j]
            if item[0] == "lit":
                if char != item[1]:
                    return False
            elif item[0] == "set":
                inside = any(low <= char <= high for low, high in item[2])
                if inside == item[1]:
                    return False
            i += 1
            j += 1
        return j == len(text)

    return walk(0, 0)


def _split(pattern):
    """Split a pattern at slashes that are not escaped and not inside a class."""
    segments = []
    current = []
    index = 0
    in_class = False
    class_start = 0
    while index < len(pattern):
        char = pattern[index]
        if in_class:
            current.append(char)
            if char == "]" and index > class_start:
                in_class = False
            index += 1
        elif char == "\\":
            current.append(pattern[index:index + 2])
            index += 2
        elif char == "[":
            current.append(char)
            in_class = True
            class_start = index + 1
            if pattern[index + 1:index + 2] == "!":
                current.append("!")
                index += 1
                class_start += 1
            index += 1
        elif char == "/":
            segments.append("".join(current))
            current = []
            index += 1
        else:
            current.append(char)
            index += 1
    segments.append("".join(current))
    return segments


def matches(pattern, path):
    """True when the whole path matches the glob pattern. See TASK.md."""
    compiled = [None if segment == "**" else _compile_segment(segment) for segment in _split(pattern)]
    if pattern == "":
        return path == ""
    parts = path.split("/")
    if all(items is None for items in compiled):
        return True

    def walk(i, j):
        if i == len(compiled):
            return j == len(parts)
        if compiled[i] is None:
            return any(walk(i + 1, k) for k in range(j, len(parts) + 1))
        return j < len(parts) and _segment_matches(compiled[i], parts[j]) and walk(i + 1, j + 1)

    return walk(0, 0)
