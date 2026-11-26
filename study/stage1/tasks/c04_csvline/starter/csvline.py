def split_line(line):
    """Splits one line of comma-separated text into its fields."""
    return [field.strip() for field in line.split(",")]
