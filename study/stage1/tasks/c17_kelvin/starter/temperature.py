def convert(value, source, target):
    """Converts a temperature between Celsius (C) and Fahrenheit (F)."""
    if source == target:
        return value
    if source == "C" and target == "F":
        return value * 9 / 5 + 32
    if source == "F" and target == "C":
        return (value - 32) * 5 / 9
    raise ValueError(f"cannot convert {source} to {target}")
