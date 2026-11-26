_BLANK = " \t"


def split_line(line):
    """Splits one line of comma-separated text into its fields."""
    fields = []
    position = 0
    while True:
        field, position = _read_field(line, position)
        fields.append(field)
        if position >= len(line):
            return fields
        position += 1


def _read_field(line, start):
    """Reads the field that starts at `start`. Returns it with the index of the comma or the line end after it."""
    position = _skip_blanks(line, start)
    if line[position:position + 1] == '"':
        return _read_quoted(line, position + 1)
    end = line.find(",", start)
    if end == -1:
        end = len(line)
    field = line[start:end].strip(_BLANK)
    if '"' in field:
        raise ValueError("a quote inside a field that does not start with one")
    return field, end


def _read_quoted(line, position):
    """Reads a quoted field from the character after its opening quote."""
    chars = []
    while True:
        if position >= len(line):
            raise ValueError("a quoted field is not closed")
        char = line[position]
        if char != '"':
            chars.append(char)
            position += 1
        elif line[position + 1:position + 2] == '"':
            chars.append('"')
            position += 2
        else:
            position = _skip_blanks(line, position + 1)
            break
    if position < len(line) and line[position] != ",":
        raise ValueError("text after a closing quote")
    return "".join(chars), position


def _skip_blanks(line, position):
    while position < len(line) and line[position] in _BLANK:
        position += 1
    return position
