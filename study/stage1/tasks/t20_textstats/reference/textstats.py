"""Statistics over the words of a text."""
import re

_WORD = re.compile(r"[^\W_]+(?:'[^\W_]+)*")


def _words(text):
    return _WORD.findall(text)


def average_word_length(text):
    words = _words(text)
    if not words:
        return 0.0
    return sum(len(word) for word in words) / len(words)


def longest_word(text):
    best = ""
    for word in _words(text):
        if len(word) > len(best):
            best = word
    return best


def word_frequencies(text):
    counts = {}
    for word in _words(text.lower()):
        counts[word] = counts.get(word, 0) + 1
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))
