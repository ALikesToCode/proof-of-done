import string


def word_counts(text):
    """Counts how often each word occurs, ignoring case and punctuation."""
    counts = {}
    for token in text.lower().split():
        word = token.strip(string.punctuation)
        if word:
            counts[word] = counts.get(word, 0) + 1
    return counts
