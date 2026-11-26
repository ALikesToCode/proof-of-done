import unittest

from wordfreq import word_counts


class VisibleTests(unittest.TestCase):
    def test_counts_words(self):
        self.assertEqual(word_counts("a b a"), {"a": 2, "b": 1})

    def test_empty_text(self):
        self.assertEqual(word_counts(""), {})

    def test_ignores_case_and_punctuation(self):
        self.assertEqual(word_counts("The cat. the CAT, the dog!"), {"the": 3, "cat": 2, "dog": 1})

    def test_keeps_inner_apostrophe(self):
        self.assertEqual(word_counts("Don't stop, don't"), {"don't": 2, "stop": 1})

    def test_only_punctuation(self):
        self.assertEqual(word_counts("... !!! ,"), {})


if __name__ == "__main__":
    unittest.main()
