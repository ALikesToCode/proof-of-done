import re

_UNITS = {"w": 604800000, "d": 86400000, "h": 3600000, "m": 60000, "s": 1000, "ms": 1}


def parse_duration(text):
    parts = re.findall(r"(\d+(?:\.\d+)?)(ms|[wdhms])", text)
    if not parts:
        raise ValueError(text)
    return round(sum(float(number) * _UNITS[unit] for number, unit in parts))
