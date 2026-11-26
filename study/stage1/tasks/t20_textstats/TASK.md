# Fix how the text statistics find words

`textstats.py` computes statistics over words. A user reported:

> `average_word_length("Hi, there!")` returns 4.5. It should be 3.5.

The module splits text at whitespace, so punctuation sticks to the words. Fix that in every function of the module.

## What a word is

1. A word is a maximal run of letters and digits (`str.isalnum()`). An apostrophe `'` between two such characters is part of the word: `don't` is one word, and `'quoted'` is the word `quoted`.
2. Everything else separates words: `well-known` is two words.

## The functions

3. `average_word_length(text)` is the mean length of the words, as a `float`. With no words it is `0.0`.
4. `longest_word(text)` is the longest word. Among equally long words the first one wins. With no words it is `""`.
5. `word_frequencies(text)` is a list of `(word, count)` tuples. Words are lower-cased before counting. The list is sorted by count, highest first, and words with the same count are in alphabetical order.

Run the provided tests with `python3 -m unittest test_visible -v`.
