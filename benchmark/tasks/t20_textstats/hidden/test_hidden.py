import unittest

from textstats import average_word_length, longest_word, word_frequencies


class HiddenTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(average_word_length("Hi, there!"), 3.5)

    def test_plain_average(self):
        self.assertEqual(average_word_length("one three"), 4.0)

    def test_longest_plain(self):
        self.assertEqual(longest_word("a bigger word"), "bigger")

    def test_frequencies_plain(self):
        self.assertEqual(word_frequencies("b a b"), [("b", 2), ("a", 1)])


    def test_average(self):
        self.assertEqual(average_word_length(""), 0.0)
        self.assertEqual(average_word_length("?!... --"), 0.0)
        self.assertEqual(average_word_length("well-known"), 4.5)
        self.assertEqual(average_word_length("don't stop"), 4.5)
        self.assertIs(type(average_word_length("ab cd")), float)

    def test_longest_ignores_punctuation(self):
        self.assertEqual(longest_word("see (parentheses), then stop."), "parentheses")
        self.assertEqual(longest_word("end... begin"), "begin")
        self.assertEqual(longest_word("tie one two"), "tie")
        self.assertEqual(longest_word("--"), "")
        self.assertEqual(longest_word("a well-known fact"), "known")

    def test_apostrophes(self):
        self.assertEqual(longest_word("it's 'quoted' text"), "quoted")
        self.assertEqual(word_frequencies("don't Don't dont"), [("don't", 2), ("dont", 1)])
        self.assertEqual(word_frequencies("rock 'n' roll"), [("n", 1), ("rock", 1), ("roll", 1)])
        self.assertEqual(word_frequencies("dogs' bowls"), [("bowls", 1), ("dogs", 1)])

    def test_frequencies(self):
        self.assertEqual(word_frequencies("The cat. The dog! the end?"), [("the", 3), ("cat", 1), ("dog", 1), ("end", 1)])
        self.assertEqual(word_frequencies("b a c a b c"), [("a", 2), ("b", 2), ("c", 2)])
        self.assertEqual(word_frequencies(""), [])
        self.assertEqual(word_frequencies("x2 x2, X2; 7"), [("x2", 3), ("7", 1)])

    def test_frequency_entries_are_tuples(self):
        result = word_frequencies("a a b")
        self.assertIsInstance(result, list)
        self.assertTrue(all(isinstance(entry, tuple) for entry in result))


if __name__ == "__main__":
    unittest.main()
