def word_counts(text):
    """Counts how often each word occurs."""
    counts = {}
    for word in text.split():
        counts[word] = counts.get(word, 0) + 1
    return counts
