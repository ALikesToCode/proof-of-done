import unittest

from search import count_of, find_first, find_last, insert_position


class HiddenTests(unittest.TestCase):
    def test_reported(self):
        self.assertEqual(find_last([1, 2, 2, 3], 3), 3)

    def test_first_and_last(self):
        self.assertEqual(find_first([1, 2, 2, 3], 2), 1)
        self.assertEqual(find_last([1, 2, 2, 3], 2), 2)

    def test_missing(self):
        self.assertEqual(find_first([1, 3], 2), -1)
        self.assertEqual(find_last([1, 3], 2), -1)

    def test_count_in_the_middle(self):
        self.assertEqual(count_of([1, 2, 2, 3], 2), 2)

    def test_insert_in_the_middle(self):
        self.assertEqual(insert_position([1, 2, 2, 3], 2), 3)


    def test_at_the_end(self):
        self.assertEqual(count_of([1, 2, 2, 3], 3), 1)
        self.assertEqual(count_of([1, 3, 3, 3], 3), 3)
        self.assertEqual(insert_position([1, 2, 2, 3], 3), 4)
        self.assertEqual(insert_position([1, 2, 2, 3], 9), 4)
        self.assertEqual(find_last([5, 5, 5], 5), 2)
        self.assertEqual(count_of([5, 5, 5], 5), 3)
        self.assertEqual(insert_position([5, 5, 5], 5), 3)

    def test_at_the_start(self):
        self.assertEqual(find_first([1, 1, 2], 1), 0)
        self.assertEqual(find_last([1, 1, 2], 1), 1)
        self.assertEqual(count_of([1, 1, 2], 1), 2)
        self.assertEqual(insert_position([1, 1, 2], 0), 0)
        self.assertEqual(insert_position([1, 1, 2], 1), 2)

    def test_empty_and_single(self):
        self.assertEqual(find_first([], 1), -1)
        self.assertEqual(find_last([], 1), -1)
        self.assertEqual(count_of([], 1), 0)
        self.assertEqual(insert_position([], 1), 0)
        self.assertEqual(find_first([4], 4), 0)
        self.assertEqual(find_last([4], 4), 0)
        self.assertEqual(count_of([4], 4), 1)
        self.assertEqual(insert_position([4], 4), 1)
        self.assertEqual(insert_position([4], 3), 0)
        self.assertEqual(insert_position([4], 5), 1)
        self.assertEqual(count_of([4], 5), 0)
        self.assertEqual(find_last([4], 5), -1)

    def test_outside_the_range(self):
        items = [10, 20, 30]
        for value in (5, 35, 15):
            self.assertEqual(find_first(items, value), -1)
            self.assertEqual(find_last(items, value), -1)
            self.assertEqual(count_of(items, value), 0)

    def test_against_a_scan(self):
        import random
        rng = random.Random(7)
        for _ in range(300):
            items = sorted(rng.randrange(8) for _ in range(rng.randrange(0, 12)))
            value = rng.randrange(-1, 9)
            positions = [index for index, item in enumerate(items) if item == value]
            self.assertEqual(find_first(items, value), positions[0] if positions else -1)
            self.assertEqual(find_last(items, value), positions[-1] if positions else -1)
            self.assertEqual(count_of(items, value), len(positions))
            self.assertEqual(insert_position(items, value), sum(1 for item in items if item <= value))

    def test_logarithmic(self):
        class Counted(int):
            calls = 0

            def __lt__(self, other):
                Counted.calls += 1
                return int.__lt__(self, other)

            def __le__(self, other):
                Counted.calls += 1
                return int.__le__(self, other)

            def __gt__(self, other):
                Counted.calls += 1
                return int.__gt__(self, other)

            def __ge__(self, other):
                Counted.calls += 1
                return int.__ge__(self, other)

            def __eq__(self, other):
                Counted.calls += 1
                return int.__eq__(self, other)

            __hash__ = int.__hash__

        items = [Counted(value // 3) for value in range(30000)]
        for function in (find_first, find_last, count_of, insert_position):
            Counted.calls = 0
            function(items, Counted(7000))
            self.assertLess(Counted.calls, 200)


if __name__ == "__main__":
    unittest.main()
