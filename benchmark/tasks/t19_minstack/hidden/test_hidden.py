import unittest

from minstack import MinStack


class HiddenTests(unittest.TestCase):
    def test_reported(self):
        stack = MinStack()
        stack.push(3)
        stack.push(1)
        self.assertEqual(stack.pop(), 1)
        self.assertEqual(stack.get_min(), 3)

    def test_stack_order(self):
        stack = MinStack()
        for value in (5, 2, 8):
            stack.push(value)
        self.assertEqual(stack.top(), 8)
        self.assertEqual(stack.get_min(), 2)
        self.assertEqual(len(stack), 3)


    def test_duplicate_minimum(self):
        stack = MinStack()
        stack.push(1)
        stack.push(1)
        stack.pop()
        self.assertEqual(stack.get_min(), 1)
        stack.push(2)
        stack.push(1)
        stack.push(1)
        stack.pop()
        self.assertEqual(stack.get_min(), 1)
        stack.pop()
        self.assertEqual(stack.get_min(), 1)
        stack.pop()
        self.assertEqual(stack.get_min(), 1)

    def test_minimum_moves_back(self):
        stack = MinStack()
        for value in (5, 3, 4, 3, 2, 2, 9):
            stack.push(value)
        seen = []
        while len(stack):
            seen.append(stack.get_min())
            stack.pop()
        self.assertEqual(seen, [2, 2, 2, 3, 3, 3, 5])

    def test_empty(self):
        stack = MinStack()
        with self.assertRaises(IndexError):
            stack.pop()
        with self.assertRaises(IndexError):
            stack.top()
        with self.assertRaises(ValueError):
            stack.get_min()
        stack.push(4)
        stack.pop()
        with self.assertRaises(ValueError):
            stack.get_min()
        self.assertEqual(len(stack), 0)

    def test_refill_after_empty(self):
        stack = MinStack()
        stack.push(1)
        stack.pop()
        stack.push(7)
        self.assertEqual(stack.get_min(), 7)
        self.assertEqual(stack.top(), 7)

    def test_constant_time(self):
        import time
        stack = MinStack()
        for value in range(200000, 0, -1):
            stack.push(value)
        started = time.perf_counter()
        total = 0
        for _ in range(200000):
            total += stack.get_min()
            stack.pop()
        self.assertLess(time.perf_counter() - started, 2.0)
        self.assertEqual(total, sum(range(1, 200001)))


if __name__ == "__main__":
    unittest.main()
