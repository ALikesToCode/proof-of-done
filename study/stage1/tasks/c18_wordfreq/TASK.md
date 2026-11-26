# Count words for the tag cloud

The tag cloud shows `The`, `the` and `the,` as three words. Make `word_counts(text)` in `wordfreq.py` ignore case and punctuation. It returns a `dict` that maps each word to the number of times it occurs.

## Rules

1. Words are counted in lower case, as `str.lower` gives it: `word_counts("The cat. the CAT, the dog!")` is `{"the": 3, "cat": 2, "dog": 1}`.
2. A word is a run of letters and digits, as `str.isalnum` defines them. So `"café"` and `"2nd"` are each one word, and `_` is not part of a word.
3. Every character that is not a letter or a digit separates words, with or without spaces around it: `"cat,dog"` is two words, `"well-known"` is `well` and `known`, and `"yes—no"` (an em dash) is `yes` and `no`.
4. The apostrophe `'` is the one exception: between two letters or digits it is part of the word, so `"don't"` is one word: `word_counts("Don't stop, don't")` is `{"don't": 2, "stop": 1}`.
5. An apostrophe at the start or at the end of a word is not part of it: `"'tis"` counts as `tis`, `"dogs'"` as `dogs`, and `"rock 'n' roll"` gives `rock`, `n` and `roll`.
6. Text with no letters or digits gives `{}`: `word_counts("... !!! ,")` is `{}`.
7. The keys of the dict are in the order in which the words first appear in the text.

Run the provided tests with `python3 -m unittest test_visible -v`.
