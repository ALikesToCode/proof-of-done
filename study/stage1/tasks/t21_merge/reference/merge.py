import copy


def _without_none(value):
    """A deep copy of a value from `override`, with None-valued keys dropped from dicts."""
    if isinstance(value, dict):
        return {key: _without_none(item) for key, item in value.items() if item is not None}
    return copy.deepcopy(value)


def deep_merge(base, override):
    """Layer `override` over `base` and return a new dict. See TASK.md."""
    result = {key: copy.deepcopy(value) for key, value in base.items()}
    for key, value in override.items():
        if value is None:
            result.pop(key, None)
        elif isinstance(value, dict) and isinstance(base.get(key), dict):
            result[key] = deep_merge(base[key], value)
        else:
            result[key] = _without_none(value)
    return result
