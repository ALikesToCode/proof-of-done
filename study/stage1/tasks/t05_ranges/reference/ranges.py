def _checked(ranges):
    for start, end in ranges:
        if start > end:
            raise ValueError(f"({start}, {end}) is not a range")
    return sorted((start, end) for start, end in ranges)


def merge(ranges):
    """Join overlapping and neighbouring closed integer ranges. See TASK.md."""
    merged = []
    for start, end in _checked(ranges):
        if merged and start <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def subtract(ranges, holes):
    """The integers in `ranges` that are not in `holes`, as merged ranges."""
    holes = merge(holes)
    result = []
    for start, end in merge(ranges):
        position = start
        for hole_start, hole_end in holes:
            if hole_end < position or hole_start > end:
                continue
            if hole_start > position:
                result.append((position, hole_start - 1))
            position = hole_end + 1
        if position <= end:
            result.append((position, end))
    return result


def count(ranges):
    """How many distinct integers the ranges hold."""
    return sum(end - start + 1 for start, end in merge(ranges))
