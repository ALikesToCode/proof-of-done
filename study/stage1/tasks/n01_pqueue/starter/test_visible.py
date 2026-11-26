import unittest

from pqueue import TaskQueue


class VisibleTests(unittest.TestCase):
    def test_highest_priority_first(self):
        queue = TaskQueue()
        queue.push("low", 1)
        queue.push("high", 9)
        queue.push("mid", 5)
        self.assertEqual([queue.pop(), queue.pop(), queue.pop()], ["high", "mid", "low"])

    def test_equal_priority_is_first_in_first_out(self):
        queue = TaskQueue()
        queue.push("first")
        queue.push("second")
        self.assertEqual(queue.pop(), "first")
        self.assertEqual(queue.pop(), "second")

    def test_peek_and_len(self):
        queue = TaskQueue()
        queue.push("a", 2)
        queue.push("b", 3)
        self.assertEqual(queue.peek(), "b")
        self.assertEqual(len(queue), 2)

    def test_pop_from_empty(self):
        with self.assertRaises(IndexError):
            TaskQueue().pop()

    def test_cancel(self):
        queue = TaskQueue()
        ticket = queue.push("a", 5)
        queue.push("b")
        self.assertTrue(queue.cancel(ticket))
        self.assertEqual(queue.pop(), "b")

    def test_reprioritize(self):
        queue = TaskQueue()
        queue.push("a")
        ticket = queue.push("b")
        queue.reprioritize(ticket, 5)
        self.assertEqual(queue.pop(), "b")
        self.assertEqual(queue.pop(), "a")


if __name__ == "__main__":
    unittest.main()
