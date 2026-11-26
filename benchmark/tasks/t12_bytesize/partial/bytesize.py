_UNITS = ["B", "KiB", "MiB", "GiB", "TiB"]


def format_size(count):
    if count < 1024:
        return f"{count} B"
    value = float(count)
    index = 0
    while value >= 1024 and index < len(_UNITS) - 1:
        value /= 1024
        index += 1
    return f"{value:.1f} {_UNITS[index]}"


def parse_size(text):
    number, unit = text.split()
    return int(float(number) * 1024 ** _UNITS.index(unit))
