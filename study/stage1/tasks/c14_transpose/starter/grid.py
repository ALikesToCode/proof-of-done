def transpose(rows):
    """Turns the rows of a table into its columns."""
    size = len(rows)
    return [[rows[r][c] for r in range(size)] for c in range(size)]
