import unittest

from netaddr import is_valid_ipv4


class HiddenTests(unittest.TestCase):
    def valid(self, *texts):
        for text in texts:
            self.assertIs(is_valid_ipv4(text), True, repr(text))

    def invalid(self, *texts):
        for text in texts:
            self.assertIs(is_valid_ipv4(text), False, repr(text))

    def test_valid_addresses(self):
        self.valid("192.168.0.1", "0.0.0.0", "255.255.255.255", "10.0.0.7", "1.2.3.4", "249.250.199.100")

    def test_wrong_number_of_parts(self):
        self.invalid("1.2.3", "1.2.3.4.5", "1", "1234", "")

    def test_empty_parts(self):
        self.invalid("1..3.4", "1.2.3.4.", ".1.2.3", "1.2.3.", "...")

    def test_words(self):
        self.invalid("not.an.ip.address", "a.b.c.d", "1.2.3.4a", "1.2.3.x", "0x1.2.3.4", "1e1.2.3.4")

    def test_signs(self):
        self.invalid("1.2.3.-4", "1.2.3.+4", "-1.2.3.4", "1.2.3.-0")

    def test_spaces_inside(self):
        self.invalid("1.2.3. 4", "1. 2.3.4", "1 .2.3.4", "1.2.3.4 5")

    def test_other_separators(self):
        self.invalid("1,2,3,4", "1.2.3,4", "1:2:3:4", "1.2.3_4", "1.2.3.1_0")

    def test_digits_outside_ascii(self):
        self.invalid("１.2.3.4", "1.2.3.٤", "١٢.1.1.1")

    def test_superscript_digit(self):
        self.invalid("1.2.3.²")

    def test_range(self):
        self.valid("255.0.0.0", "0.0.0.255", "199.200.201.202")
        self.invalid("256.0.0.0", "999.1.1.1", "0.0.0.256", "1.2.300.4", "1.2.3.1000")

    def test_leading_zeros(self):
        self.valid("0.1.0.1", "10.100.0.0")
        self.invalid("01.2.3.4", "1.2.3.00", "1.2.3.010", "1.02.3.4", "000.0.0.0")

    def test_text_around_the_address(self):
        self.invalid(" 1.2.3.4", "1.2.3.4 ", "1.2.3.4\n", "\t1.2.3.4", "\n1.2.3.4")

    def test_not_a_string(self):
        self.invalid(None, 16909060, 1.2, ["1", "2", "3", "4"], (1, 2, 3, 4))

    def test_bytes(self):
        self.invalid(b"1.2.3.4", bytearray(b"1.2.3.4"))


if __name__ == "__main__":
    unittest.main()
