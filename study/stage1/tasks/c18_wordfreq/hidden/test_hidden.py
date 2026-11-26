import unittest

from wordfreq import word_counts


class HiddenTests(unittest.TestCase):
    def test_plain_words(self):
        self.assertEqual(word_counts("a b a"), {"a": 2, "b": 1})
        self.assertEqual(word_counts(""), {})

    def test_ignores_case_and_punctuation(self):
        self.assertEqual(word_counts("The cat. the CAT, the dog!"), {"the": 3, "cat": 2, "dog": 1})
        self.assertEqual(word_counts("(Hello) [hello] HELLO?"), {"hello": 3})

    def test_letters_and_digits(self):
        self.assertEqual(word_counts("The 2nd of 3, the 2ND"), {"the": 2, "2nd": 2, "of": 1, "3": 1})
        self.assertEqual(word_counts("Café, café. CAFÉ"), {"café": 3})

    def test_underscore_is_not_part_of_a_word(self):
        self.assertEqual(word_counts("snake_case"), {"snake": 1, "case": 1})
        self.assertEqual(word_counts("_x_ x"), {"x": 2})

    def test_punctuation_without_spaces(self):
        self.assertEqual(word_counts("cat,dog"), {"cat": 1, "dog": 1})
        self.assertEqual(word_counts("one.two;three/one"), {"one": 2, "two": 1, "three": 1})

    def test_hyphen_and_dash(self):
        self.assertEqual(word_counts("A well-known, WELL-known fact"), {"a": 1, "well": 2, "known": 2, "fact": 1})
        self.assertEqual(word_counts("yes—no"), {"yes": 1, "no": 1})

    def test_punctuation_outside_ascii(self):
        self.assertEqual(word_counts("“Hello,” she said. ¿Hello?"), {"hello": 2, "she": 1, "said": 1})

    def test_whitespace_of_any_kind(self):
        self.assertEqual(word_counts("a\tb\nA\r\nb  a"), {"a": 3, "b": 2})

    def test_keeps_inner_apostrophe(self):
        self.assertEqual(word_counts("Don't stop, don't"), {"don't": 2, "stop": 1})
        self.assertEqual(word_counts("The '90s and the 5 o'clock show"), {"the": 2, "90s": 1, "and": 1, "5": 1, "o'clock": 1, "show": 1})

    def test_apostrophe_at_the_edges(self):
        self.assertEqual(word_counts("'tis"), {"tis": 1})
        self.assertEqual(word_counts("the dogs' bowls"), {"the": 1, "dogs": 1, "bowls": 1})
        self.assertEqual(word_counts("rock 'n' roll"), {"rock": 1, "n": 1, "roll": 1})

    def test_quoted_word_with_inner_apostrophe(self):
        self.assertEqual(word_counts("'don't' don't"), {"don't": 2})

    def test_no_letters_or_digits(self):
        self.assertEqual(word_counts("... !!! ,"), {})
        self.assertEqual(word_counts(" ' -- ' "), {})

    def test_order_of_first_appearance(self):
        self.assertEqual(list(word_counts("The cat. the CAT, the dog!")), ["the", "cat", "dog"])
        self.assertEqual(list(word_counts("b a c a b")), ["b", "a", "c"])

    def test_returns_a_dict(self):
        counts = word_counts("x y x")
        self.assertIs(type(counts), dict)
        self.assertEqual(counts["x"], 2)


if __name__ == "__main__":
    unittest.main()
