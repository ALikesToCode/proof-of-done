import unittest

from lru import LRUCache


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class VisibleTests(unittest.TestCase):
    def test_entry_expires(self):
        clock = Clock()
        cache = LRUCache(2, ttl=10, clock=clock)
        cache.put("a", 1)
        clock.now = 5
        self.assertEqual(cache.get("a"), 1)
        clock.now = 11
        self.assertIsNone(cache.get("a"))

    def test_no_ttl_never_expires(self):
        clock = Clock()
        cache = LRUCache(2, clock=clock)
        cache.put("a", 1)
        clock.now = 1e9
        self.assertEqual(cache.get("a"), 1)

    def test_lru_eviction_still_works(self):
        cache = LRUCache(2)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.get("a")
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["a", "c"])


if __name__ == "__main__":
    unittest.main()
