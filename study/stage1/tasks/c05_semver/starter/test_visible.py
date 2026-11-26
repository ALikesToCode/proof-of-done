import unittest

from versions import compare


class VisibleTests(unittest.TestCase):
    def test_equal(self):
        self.assertEqual(compare("1.2.3", "1.2.3"), 0)

    def test_newer_patch(self):
        self.assertEqual(compare("1.2.4", "1.2.3"), 1)

    def test_two_digit_minor(self):
        self.assertEqual(compare("1.10.0", "1.9.0"), 1)

    def test_two_digit_major(self):
        self.assertEqual(compare("2.0.0", "10.0.0"), -1)

    def test_pre_release_is_older(self):
        self.assertEqual(compare("1.2.0-rc1", "1.2.0"), -1)


if __name__ == "__main__":
    unittest.main()
