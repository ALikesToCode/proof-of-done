import unittest

from textstats import average_word_length, longest_word, word_frequencies


class VisibleTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(average_word_length("Hi, there!"), 3.5)

    def test_plain_average(self):
        self.assertEqual(average_word_length("one three"), 4.0)

    def test_longest_plain(self):
        self.assertEqual(longest_word("a bigger word"), "bigger")

    def test_frequencies_plain(self):
        self.assertEqual(word_frequencies("b a b"), [("b", 2), ("a", 1)])


if __name__ == "__main__":
    unittest.main()
