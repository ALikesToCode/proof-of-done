# Wrap text to a width

Implement `wrap(text, width, indent="")` in `wrap.py`. It returns a list of lines (`list[str]`) with no newline characters in them.

## Rules

1. **Paragraphs.** `text` is split at every `"\n"`. Each piece is a paragraph and is wrapped on its own, and the lines of all paragraphs are returned in order. A paragraph with no words (empty or only whitespace) gives exactly one empty line `""`. So `wrap("", 10)` is `[""]` and `wrap("a\n\nb", 10)` is `["a", "", "b"]`.
2. **Words.** Inside a paragraph, a word is a maximal run of non-whitespace characters. Words on a line are joined by one space, whatever whitespace separated them in the input. No line starts or ends with whitespace that came from the text.
3. **Greedy filling.** Each line takes as many words as fit. A line is never longer than `width` characters, and a word moves to the next line only when it does not fit on the current one. A line of exactly `width` characters fits.
4. **Hanging indent.** Every line of a paragraph except its first starts with `indent`. The indent counts toward `width`. The first line of each paragraph has no indent. The empty line of a paragraph with no words has no indent.
5. **Long words.** When a word does not fit on the current line, a new line starts. When it does not fit on an empty line either, that line is filled with as much of the word as fits, and the rest of the word continues on the next line by the same rule. Words that follow may share the line with the last piece.
6. **Arguments.** `width` must be an `int` of at least 1, and `indent` must be shorter than `width`. Otherwise `ValueError`.

Example: `wrap("the quick brown fox", 10, "  ")` is `["the quick", "  brown", "  fox"]`.

Run the provided tests with `python3 -m unittest test_visible -v`.
