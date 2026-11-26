import unittest

from cache import LRUCache


def filled(capacity, *keys):
    cache = LRUCache(capacity)
    for number, key in enumerate(keys, start=1):
        cache.put(key, number)
    return cache


class HiddenTests(unittest.TestCase):
    def test_stores_and_reads(self):
        cache = filled(2, "a")
        self.assertEqual(cache.get("a"), 1)

    def test_plain_eviction_order(self):
        cache = filled(2, "a", "b", "c")
        self.assertEqual(len(cache), 2)
        self.assertNotIn("a", cache)
        self.assertIn("b", cache)
        self.assertIn("c", cache)

    def test_read_refreshes(self):
        cache = filled(2, "a", "b")
        self.assertEqual(cache.get("a"), 1)
        cache.put("c", 3)
        self.assertIn("a", cache)
        self.assertIn("c", cache)
        self.assertNotIn("b", cache)

    def test_read_moves_key_in_keys(self):
        cache = filled(3, "a", "b", "c")
        cache.get("a")
        self.assertEqual(cache.keys(), ["b", "c", "a"])

    def test_latest_read_wins(self):
        cache = filled(2, "a", "b")
        cache.get("a")
        cache.get("b")
        cache.put("c", 3)
        self.assertNotIn("a", cache)
        self.assertIn("b", cache)

    def test_missing_key_gives_default(self):
        self.assertEqual(LRUCache(1).get("nope", 7), 7)
        self.assertIsNone(LRUCache(1).get("nope"))

    def test_missing_get_stores_nothing(self):
        cache = filled(2, "a")
        cache.get("x", 5)
        self.assertEqual(len(cache), 1)
        self.assertNotIn("x", cache)
        self.assertEqual(cache.keys(), ["a"])

    def test_missing_get_changes_no_order(self):
        cache = filled(3, "a", "b", "c")
        cache.get("zzz")
        self.assertEqual(cache.keys(), ["a", "b", "c"])

    def test_put_again_replaces_value(self):
        cache = filled(2, "a")
        cache.put("a", 10)
        self.assertEqual(cache.get("a"), 10)
        self.assertEqual(len(cache), 1)

    def test_put_again_on_full_cache_drops_nothing(self):
        cache = filled(2, "a", "b")
        cache.put("a", 10)
        self.assertEqual(len(cache), 2)
        self.assertIn("a", cache)
        self.assertIn("b", cache)

    def test_put_again_refreshes(self):
        cache = filled(2, "a", "b")
        cache.put("a", 10)
        cache.put("c", 3)
        self.assertEqual(cache.get("a"), 10)
        self.assertNotIn("b", cache)

    def test_put_again_moves_key_in_keys(self):
        cache = filled(3, "a", "b", "c")
        cache.put("a", 10)
        self.assertEqual(cache.keys(), ["b", "c", "a"])

    def test_contains_and_len_are_not_uses(self):
        cache = filled(2, "a", "b")
        self.assertIn("a", cache)
        self.assertEqual(len(cache), 2)
        self.assertEqual(cache.keys(), ["a", "b"])
        cache.put("c", 3)
        self.assertNotIn("a", cache)
        self.assertIn("b", cache)

    def test_keys_order(self):
        self.assertEqual(filled(3, "a", "b", "c").keys(), ["a", "b", "c"])
        self.assertEqual(filled(2, "a", "b", "c").keys(), ["b", "c"])
        self.assertEqual(LRUCache(2).keys(), [])

    def test_keys_is_a_list_and_not_a_use(self):
        cache = filled(2, "a", "b")
        self.assertIs(type(cache.keys()), list)
        self.assertEqual(cache.keys(), ["a", "b"])
        cache.put("c", 3)
        self.assertEqual(cache.keys(), ["b", "c"])

    def test_none_value(self):
        cache = LRUCache(2)
        cache.put("a", None)
        self.assertIsNone(cache.get("a", 7))
        self.assertIn("a", cache)
        self.assertEqual(len(cache), 1)

    def test_reading_none_counts_as_a_use(self):
        cache = LRUCache(2)
        cache.put("a", None)
        cache.put("b", 2)
        cache.get("a")
        cache.put("c", 3)
        self.assertIn("a", cache)
        self.assertNotIn("b", cache)

    def test_capacity_below_one(self):
        for capacity in (0, -1):
            with self.assertRaises(ValueError):
                LRUCache(capacity)

    def test_capacity_one(self):
        cache = filled(1, "a", "b")
        self.assertEqual(cache.keys(), ["b"])


if __name__ == "__main__":
    unittest.main()
