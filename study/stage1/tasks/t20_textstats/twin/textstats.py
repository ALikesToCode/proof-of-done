"""Statistics over the words of a text."""
import string


def average_word_length(text):
    words = [word.strip(string.punctuation) for word in text.split()]
    words = [word for word in words if word]
    if not words:
        return 0.0
    return sum(len(word) for word in words) / len(words)


def longest_word(text):
    best = ""
    for word in text.split():
        if len(word) > len(best):
            best = word
    return best


def word_frequencies(text):
    counts = {}
    for word in text.lower().split():
        counts[word] = counts.get(word, 0) + 1
    return sorted(counts.items(), key=lambda item: -item[1])
