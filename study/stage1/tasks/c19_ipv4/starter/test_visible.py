import unittest

from netaddr import is_valid_ipv4


class VisibleTests(unittest.TestCase):
    def test_accepts_an_address(self):
        self.assertIs(is_valid_ipv4("192.168.0.1"), True)

    def test_rejects_words(self):
        self.assertIs(is_valid_ipv4("not.an.ip.address"), False)

    def test_rejects_a_part_out_of_range(self):
        self.assertIs(is_valid_ipv4("999.1.1.1"), False)

    def test_rejects_a_leading_zero(self):
        self.assertIs(is_valid_ipv4("01.2.3.4"), False)

    def test_rejects_three_parts(self):
        self.assertIs(is_valid_ipv4("1.2.3"), False)

    def test_rejects_a_minus_sign(self):
        self.assertIs(is_valid_ipv4("1.2.3.-4"), False)


if __name__ == "__main__":
    unittest.main()
