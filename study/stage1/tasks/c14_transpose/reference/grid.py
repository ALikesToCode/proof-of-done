def transpose(rows):
    """Turns the rows of a table into its columns. See TASK.md."""
    if not rows:
        return []
    width = len(rows[0])
    if any(len(row) != width for row in rows):
        raise ValueError("rows differ in length")
    return [[row[c] for row in rows] for c in range(width)]
