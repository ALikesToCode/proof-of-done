import unittest

from minstack import MinStack


class VisibleTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
