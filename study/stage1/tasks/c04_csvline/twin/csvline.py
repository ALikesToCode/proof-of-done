_BLANK = " \t"


def split_line(line):
    """Splits one line of comma-separated text into its fields."""
    fields, current, quoted, i = [], [], False, 0
    while i < len(line):
        char = line[i]
        if quoted:
            if char == '"' and line[i + 1:i + 2] == '"':
                current.append('"')
                i += 1
            elif char == '"':
                quoted = False
            else:
                current.append(char)
        elif char == '"':
            quoted = True
        elif char == ",":
            fields.append("".join(current).strip(_BLANK))
            current = []
        else:
            current.append(char)
        i += 1
    if quoted:
        raise ValueError("a quoted field is not closed")
    fields.append("".join(current).strip(_BLANK))
    return fields
