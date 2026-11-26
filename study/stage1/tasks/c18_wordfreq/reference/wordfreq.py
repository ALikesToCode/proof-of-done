import re

_WORD = re.compile(r"[^\W_]+(?:'[^\W_]+)*")


def word_counts(text):
    """Counts how often each word occurs, ignoring case and punctuation. See TASK.md."""
    counts = {}
    for word in _WORD.findall(text.lower()):
        counts[word] = counts.get(word, 0) + 1
    return counts
