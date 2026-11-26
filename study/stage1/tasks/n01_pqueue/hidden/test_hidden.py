import unittest

from pqueue import TaskQueue


def drain(queue):
    items = []
    while len(queue):
        items.append(queue.pop())
    return items


class HiddenTests(unittest.TestCase):
    def test_highest_priority_first(self):
        queue = TaskQueue()
        queue.push("low", 1)
        queue.push("high", 9)
        queue.push("mid", 5)
        self.assertEqual(drain(queue), ["high", "mid", "low"])

    def test_default_priority_is_zero(self):
        queue = TaskQueue()
        queue.push("default")
        queue.push("minus", -1)
        queue.push("plus", 1)
        self.assertEqual(drain(queue), ["plus", "default", "minus"])

    def test_negative_priorities(self):
        queue = TaskQueue()
        queue.push("a", -5)
        queue.push("b", -2)
        queue.push("c", -9)
        self.assertEqual(drain(queue), ["b", "a", "c"])

    def test_equal_priority_is_first_in_first_out(self):
        queue = TaskQueue()
        for name in "abcde":
            queue.push(name, 3)
        self.assertEqual(drain(queue), list("abcde"))

    def test_first_in_first_out_within_each_priority(self):
        queue = TaskQueue()
        for name, priority in (("a", 1), ("b", 2), ("c", 1), ("d", 2), ("e", 1), ("f", 0)):
            queue.push(name, priority)
        self.assertEqual(drain(queue), ["b", "d", "a", "c", "e", "f"])

    def test_push_between_pops(self):
        queue = TaskQueue()
        queue.push("a")
        queue.push("b")
        self.assertEqual(queue.pop(), "a")
        queue.push("c")
        queue.push("d", 1)
        self.assertEqual(drain(queue), ["d", "b", "c"])

    def test_tickets_count_up(self):
        queue = TaskQueue()
        self.assertEqual(queue.push("a"), 1)
        self.assertEqual(queue.push("b", 7), 2)
        queue.pop()
        queue.cancel(1)
        self.assertEqual(queue.push("c"), 3)
        ticket = queue.push("d", -4)
        self.assertEqual(ticket, 4)
        self.assertIs(type(ticket), int)

    def test_each_queue_has_its_own_tickets(self):
        first = TaskQueue()
        first.push("a")
        first.push("b")
        second = TaskQueue()
        self.assertEqual(second.push("x"), 1)
        self.assertEqual(first.push("c"), 3)

    def test_peek_leaves_the_item(self):
        queue = TaskQueue()
        queue.push("a", 2)
        queue.push("b", 3)
        self.assertEqual(queue.peek(), "b")
        self.assertEqual(queue.peek(), "b")
        self.assertEqual(len(queue), 2)
        self.assertEqual(queue.pop(), "b")
        self.assertEqual(queue.peek(), "a")

    def test_empty_queue_raises(self):
        queue = TaskQueue()
        with self.assertRaises(IndexError):
            queue.pop()
        with self.assertRaises(IndexError):
            queue.peek()
        queue.push("a")
        queue.pop()
        with self.assertRaises(IndexError):
            queue.pop()
        with self.assertRaises(IndexError):
            queue.peek()

    def test_empty_after_cancel_raises(self):
        queue = TaskQueue()
        ticket = queue.push("a")
        queue.cancel(ticket)
        with self.assertRaises(IndexError):
            queue.peek()
        with self.assertRaises(IndexError):
            queue.pop()

    def test_len(self):
        queue = TaskQueue()
        self.assertEqual(len(queue), 0)
        first = queue.push("a")
        queue.push("b", 4)
        queue.push("c")
        self.assertEqual(len(queue), 3)
        queue.pop()
        self.assertEqual(len(queue), 2)
        queue.cancel(first)
        self.assertEqual(len(queue), 1)
        queue.cancel(first)
        self.assertEqual(len(queue), 1)

    def test_cancel_removes_the_item(self):
        queue = TaskQueue()
        queue.push("a", 1)
        ticket = queue.push("b", 9)
        queue.push("c", 5)
        self.assertIs(queue.cancel(ticket), True)
        self.assertEqual(queue.peek(), "c")
        self.assertEqual(drain(queue), ["c", "a"])

    def test_cancel_in_the_middle(self):
        queue = TaskQueue()
        queue.push("a")
        ticket = queue.push("b")
        queue.push("c")
        self.assertTrue(queue.cancel(ticket))
        self.assertEqual(drain(queue), ["a", "c"])

    def test_cancel_of_a_ticket_that_is_not_waiting(self):
        queue = TaskQueue()
        popped = queue.push("a", 9)
        cancelled = queue.push("b")
        queue.push("c")
        queue.push("d")
        self.assertEqual(queue.pop(), "a")
        self.assertIs(queue.cancel(cancelled), True)
        for ticket in (popped, cancelled, 0, 99, -1):
            self.assertIs(queue.cancel(ticket), False)
            self.assertEqual(len(queue), 2)
        self.assertEqual(drain(queue), ["c", "d"])

    def test_reprioritize_up_and_down(self):
        queue = TaskQueue()
        first = queue.push("a", 4)
        queue.push("b", 2)
        last = queue.push("c", 1)
        self.assertIsNone(queue.reprioritize(last, 8))
        self.assertEqual(queue.peek(), "c")
        queue.reprioritize(first, -3)
        self.assertEqual(len(queue), 3)
        self.assertEqual(drain(queue), ["c", "b", "a"])

    def test_reprioritize_keeps_push_order(self):
        queue = TaskQueue()
        a = queue.push("a")
        queue.push("b")
        queue.push("c", 5)
        queue.reprioritize(a, 5)
        self.assertEqual(drain(queue), ["a", "c", "b"])

    def test_reprioritize_into_the_middle_of_a_group(self):
        queue = TaskQueue()
        queue.push("a", 1)
        b = queue.push("b", 7)
        queue.push("c", 1)
        queue.push("d", 1)
        queue.reprioritize(b, 1)
        self.assertEqual(drain(queue), ["a", "b", "c", "d"])

    def test_reprioritize_to_the_same_priority(self):
        queue = TaskQueue()
        a = queue.push("a")
        queue.push("b")
        queue.reprioritize(a, 0)
        self.assertEqual(drain(queue), ["a", "b"])

    def test_reprioritize_there_and_back(self):
        queue = TaskQueue()
        a = queue.push("a")
        queue.push("b")
        queue.reprioritize(a, 5)
        queue.reprioritize(a, 0)
        self.assertEqual(len(queue), 2)
        self.assertEqual(drain(queue), ["a", "b"])

    def test_reprioritized_item_keeps_its_ticket(self):
        queue = TaskQueue()
        a = queue.push("a")
        queue.push("b", 1)
        queue.reprioritize(a, 3)
        self.assertEqual(queue.push("c"), 3)
        self.assertIs(queue.cancel(a), True)
        self.assertEqual(drain(queue), ["b", "c"])

    def test_reprioritize_of_a_ticket_that_is_not_waiting(self):
        queue = TaskQueue()
        popped = queue.push("a", 9)
        cancelled = queue.push("b")
        queue.push("c")
        queue.pop()
        queue.cancel(cancelled)
        for ticket in (popped, cancelled, 0, 99):
            with self.assertRaises(KeyError):
                queue.reprioritize(ticket, 5)
        self.assertEqual(len(queue), 1)
        self.assertEqual(drain(queue), ["c"])

    def test_items_that_cannot_be_compared_or_hashed(self):
        queue = TaskQueue()
        first, second, third = {"n": 1}, {"n": 2}, [3]
        queue.push(first)
        ticket = queue.push(second)
        queue.push(third)
        queue.push({"n": 4}, 2)
        self.assertEqual(queue.peek(), {"n": 4})
        queue.reprioritize(ticket, 1)
        self.assertEqual(queue.pop(), {"n": 4})
        self.assertIs(queue.pop(), second)
        self.assertIs(queue.pop(), first)
        self.assertIs(queue.pop(), third)

    def test_same_item_pushed_twice(self):
        queue = TaskQueue()
        item = {"job": "x"}
        first = queue.push(item)
        second = queue.push(item, 1)
        self.assertNotEqual(first, second)
        self.assertEqual(len(queue), 2)
        self.assertIs(queue.cancel(second), True)
        self.assertEqual(len(queue), 1)
        self.assertIs(queue.pop(), item)


if __name__ == "__main__":
    unittest.main()
