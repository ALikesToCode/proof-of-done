import unittest

from cache import LRUCache


class VisibleTests(unittest.TestCase):
    def test_stores_and_reads(self):
        cache = LRUCache(2)
        cache.put("a", 1)
        self.assertEqual(cache.get("a"), 1)

    def test_evicts_when_full(self):
        cache = LRUCache(2)
        cache.put("a", 1)
        cache.put("b", 2)
        cache.put("c", 3)
        self.assertEqual(len(cache), 2)
        self.assertIn("c", cache)

    def test_read_refreshes(self):
        cache = LRUCache(2)
        cache.put("a", 1)
        cache.put("b", 2)
        self.assertEqual(cache.get("a"), 1)
        cache.put("c", 3)
        self.assertIn("a", cache)
        self.assertNotIn("b", cache)

    def test_keys_in_order_of_use(self):
        cache = LRUCache(3)
        cache.put("a", 1)
        cache.put("b", 2)
        self.assertEqual(cache.keys(), ["a", "b"])


if __name__ == "__main__":
    unittest.main()
