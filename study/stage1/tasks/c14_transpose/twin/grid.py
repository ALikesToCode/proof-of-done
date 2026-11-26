def transpose(rows):
    """Turns the rows of a table into its columns."""
    if not rows:
        return []
    width = len(rows[0])
    try:
        return [[row[c] for row in rows] for c in range(width)]
    except IndexError:
        raise ValueError("rows differ in length") from None
