import unittest

from lru import LRUCache


class Clock:
    def __init__(self):
        self.now = 0.0

    def __call__(self):
        return self.now


class HiddenTests(unittest.TestCase):
    def setUp(self):
        self.clock = Clock()

    def test_visible_cases(self):
        cache = LRUCache(2, ttl=10, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 5
        self.assertEqual(cache.get("a"), 1)
        self.clock.now = 11
        self.assertIsNone(cache.get("a"))
        plain = LRUCache(2)
        plain.put("a", 1)
        plain.put("b", 2)
        plain.get("a")
        plain.put("c", 3)
        self.assertEqual(plain.keys(), ["a", "c"])

    def test_expired_exactly_at_ttl(self):
        cache = LRUCache(2, ttl=10, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 9.999
        self.assertEqual(cache.get("a"), 1)
        self.clock.now = 10
        self.assertIsNone(cache.get("a"))

    def test_expired_is_absent_everywhere(self):
        cache = LRUCache(3, ttl=10, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 4
        cache.put("b", 2)
        self.clock.now = 10
        self.assertEqual(len(cache), 1)
        self.assertNotIn("a", cache)
        self.assertIn("b", cache)
        self.assertEqual(cache.keys(), ["b"])
        self.assertEqual(cache.peek("a", "gone"), "gone")
        self.assertEqual(cache.get("a", "gone"), "gone")

    def test_len_without_any_get(self):
        cache = LRUCache(3, ttl=5, clock=self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        self.clock.now = 5
        self.assertEqual(len(cache), 0)
        self.assertEqual(cache.keys(), [])

    def test_expired_removed_before_live_is_evicted(self):
        cache = LRUCache(2, clock=self.clock)
        cache.put("live", 1)
        cache.put("short", 2, ttl=5)
        self.clock.now = 6
        cache.put("new", 3)
        self.assertEqual(cache.keys(), ["live", "new"])
        self.assertEqual(cache.get("live"), 1)

    def test_live_evicted_when_nothing_expired(self):
        cache = LRUCache(2, ttl=100, clock=self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["b", "c"])

    def test_per_put_ttl_overrides_default(self):
        cache = LRUCache(3, ttl=10, clock=self.clock)
        cache.put("short", 1, ttl=2)
        cache.put("default", 2)
        cache.put("forever", 3, ttl=None)
        self.clock.now = 2
        self.assertNotIn("short", cache)
        self.assertIn("default", cache)
        self.clock.now = 1000
        self.assertNotIn("default", cache)
        self.assertEqual(cache.get("forever"), 3)

    def test_put_existing_restarts_lifetime(self):
        cache = LRUCache(2, ttl=10, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 8
        cache.put("a", 2)
        self.clock.now = 17
        self.assertEqual(cache.get("a"), 2)
        self.clock.now = 18
        self.assertIsNone(cache.get("a"))

    def test_put_existing_uses_ttl_of_this_call(self):
        cache = LRUCache(2, ttl=10, clock=self.clock)
        cache.put("a", 1, ttl=100)
        cache.put("a", 2)
        self.clock.now = 10
        self.assertNotIn("a", cache)

    def test_put_existing_makes_most_recent(self):
        cache = LRUCache(2, clock=self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("a", 10)
        self.assertEqual(cache.keys(), ["b", "a"])
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["a", "c"])
        self.assertEqual(len(cache), 2)

    def test_get_does_not_restart_lifetime(self):
        cache = LRUCache(2, ttl=10, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 9
        self.assertEqual(cache.get("a"), 1)
        self.clock.now = 10
        self.assertIsNone(cache.get("a"))

    def test_peek_changes_nothing(self):
        cache = LRUCache(2, clock=self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        self.assertEqual(cache.peek("a"), 1)
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["b", "c"])
        self.assertEqual(cache.peek("missing", 7), 7)

    def test_get_refreshes_recency(self):
        cache = LRUCache(2, ttl=50, clock=self.clock)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.get("a")
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["a", "c"])

    def test_bad_ttl(self):
        for ttl in (0, -1):
            with self.assertRaises(ValueError):
                LRUCache(2, ttl=ttl)
        cache = LRUCache(2, clock=self.clock)
        for ttl in (0, -5):
            with self.assertRaises(ValueError):
                cache.put("a", 1, ttl=ttl)
        self.assertNotIn("a", cache)
        self.assertEqual(len(cache), 0)

    def test_bad_capacity(self):
        with self.assertRaises(ValueError):
            LRUCache(0)

    def test_expired_key_put_again_is_new(self):
        cache = LRUCache(1, ttl=5, clock=self.clock)
        cache.put("a", 1)
        self.clock.now = 5
        cache.put("a", 2)
        self.assertEqual(cache.get("a"), 2)
        self.assertEqual(len(cache), 1)


if __name__ == "__main__":
    unittest.main()
