def _checked(ranges):
    for start, end in ranges:
        if start > end:
            raise ValueError("bad range")
    return sorted(ranges)


def merge(ranges):
    merged = []
    for start, end in _checked(ranges):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged


def subtract(ranges, holes):
    result = []
    for start, end in merge(ranges):
        position = start
        for hole_start, hole_end in merge(holes):
            if hole_end < position or hole_start > end:
                continue
            if hole_start > position:
                result.append((position, hole_start - 1))
            position = hole_end + 1
        if position <= end:
            result.append((position, end))
    return result


def count(ranges):
    return sum(end - start + 1 for start, end in merge(ranges))
