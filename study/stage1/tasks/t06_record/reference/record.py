def _check_delimiter(delimiter):
    if not isinstance(delimiter, str) or len(delimiter) != 1 or delimiter in '"\n\r':
        raise ValueError("the delimiter must be one character, and not a quote or a line break")


def parse_record(text, delimiter=","):
    """Split one delimited record into its fields. See TASK.md."""
    _check_delimiter(delimiter)
    fields = []
    position = 0
    while True:
        if text[position:position + 1] == '"':
            position += 1
            pieces = []
            while True:
                closing = text.find('"', position)
                if closing < 0:
                    raise ValueError("a quoted field is not closed")
                pieces.append(text[position:closing])
                if text[closing + 1:closing + 2] == '"':
                    pieces.append('"')
                    position = closing + 2
                else:
                    position = closing + 1
                    break
            fields.append("".join(pieces))
            if position < len(text) and text[position] != delimiter:
                raise ValueError("text after a closing quote")
        else:
            end = text.find(delimiter, position)
            if end < 0:
                end = len(text)
            field = text[position:end]
            if '"' in field or "\n" in field or "\r" in field:
                raise ValueError("a quote or a line break in an unquoted field")
            fields.append(field)
            position = end
        if position >= len(text):
            return fields
        position += 1


def format_record(fields, delimiter=","):
    """Write fields as one delimited record. See TASK.md."""
    _check_delimiter(delimiter)
    fields = list(fields)
    if not fields or not all(isinstance(field, str) for field in fields):
        raise ValueError("fields must be one or more strings")
    written = []
    for field in fields:
        needs_quotes = (
            delimiter in field
            or '"' in field
            or "\n" in field
            or "\r" in field
            or field.startswith(" ")
            or field.endswith(" ")
        )
        written.append('"' + field.replace('"', '""') + '"' if needs_quotes else field)
    return delimiter.join(written)
