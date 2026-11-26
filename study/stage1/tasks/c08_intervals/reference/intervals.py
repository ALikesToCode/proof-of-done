def merge(intervals):
    """Joins (start, end) intervals that overlap or touch."""
    pairs = []
    for start, end in intervals:
        if end < start:
            raise ValueError(f"an interval ends before it starts: {(start, end)!r}")
        pairs.append((start, end))
    merged = []
    for start, end in sorted(pairs):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    return merged
