# Priority queue with tickets

Implement the class `TaskQueue` in `pqueue.py`. It holds items that wait to be handled, most urgent first. A new `TaskQueue()` is empty.

## Rules

1. `push(item, priority=0)` adds `item` and returns its ticket, an `int`. The first push on a queue returns 1 and each later push returns one more than the push before it, whatever was popped or cancelled in between.
2. `pop()` removes and returns the item with the highest priority. Priorities are `int`s, a larger number is a higher priority, and priorities may be negative.
3. Among items of equal priority, the one that was pushed first comes out first.
4. `peek()` returns the item that `pop()` would return and leaves it in the queue. `pop()` and `peek()` raise `IndexError` when the queue is empty.
5. `len(queue)` is the number of items waiting in the queue.
6. `cancel(ticket)` removes the item with that ticket and returns `True`. When the ticket is not waiting (it was never issued, or its item was already popped or cancelled) it returns `False` and changes nothing.
7. `reprioritize(ticket, priority)` gives a waiting item a new priority and returns `None`. The item keeps its place in push order: among items of its new priority it comes out before those pushed after it and after those pushed before it. For example, after `a = queue.push("a")`, `queue.push("b")`, `queue.push("c", 5)` and `queue.reprioritize(a, 5)` the pops give `"a"`, `"c"`, `"b"`. A ticket that is not waiting raises `KeyError`.
8. Items are never compared with each other and never hashed, so the queue works with items such as dicts. The same item may be pushed more than once; each push is a separate entry with its own ticket.

Run the provided tests with `python3 -m unittest test_visible -v`.
