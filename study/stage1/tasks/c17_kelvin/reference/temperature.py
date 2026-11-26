_LOWEST = {"C": -273.15, "F": -459.67, "K": 0.0}
_TO_CELSIUS = {
    "C": lambda value: value,
    "F": lambda value: (value - 32) * 5 / 9,
    "K": lambda value: value - 273.15,
}
_FROM_CELSIUS = {
    "C": lambda value: value,
    "F": lambda value: value * 9 / 5 + 32,
    "K": lambda value: value + 273.15,
}


def convert(value, source, target):
    """Converts a temperature between Celsius (C), Fahrenheit (F) and Kelvin (K). See TASK.md."""
    if source not in _LOWEST or target not in _LOWEST:
        raise ValueError(f"cannot convert {source} to {target}")
    if value < _LOWEST[source]:
        raise ValueError("below absolute zero")
    if source == target:
        result = value
    else:
        result = _FROM_CELSIUS[target](_TO_CELSIUS[source](value))
    return round(float(result), 2) + 0.0
