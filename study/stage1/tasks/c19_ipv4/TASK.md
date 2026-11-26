# Tighten the IPv4 check

The allow-list form accepts addresses such as `999.1.1.1` and `01.2.3.4`. Tighten `is_valid_ipv4(text)` in `netaddr.py`. It says whether `text` is an IPv4 address in the usual dotted form, such as `"192.168.0.1"`.

## Rules

1. An address is exactly four parts separated by single dots. `"1.2.3"`, `"1.2.3.4.5"`, `"1..3.4"`, `"1.2.3.4."` and `""` are not valid.
2. Each part is one or more of the ASCII digits `0` to `9` and nothing else. A sign, a space or a letter makes the address invalid: `"1.2.3.-4"`, `"1.2.3.+4"`, `"1.2.3. 4"` and `"1.2.3.4a"` are not valid.
3. Digits from outside ASCII do not count as digits: `"１.2.3.4"` (a full-width 1), `"1.2.3.٤"` (an Arabic-Indic 4) and `"1.2.3.²"` (a superscript 2) are not valid.
4. Each part is a number from 0 to 255: `"0.0.0.0"` and `"255.255.255.255"` are valid, and `"256.0.0.0"` and `"999.1.1.1"` are not.
5. A part has no leading zeros, so the only part that may start with `0` is `0` itself: `"01.2.3.4"`, `"1.2.3.00"` and `"1.2.3.010"` are not valid.
6. Nothing may come before or after the address: `" 1.2.3.4"`, `"1.2.3.4 "` and `"1.2.3.4\n"` are not valid.
7. The result is always the `bool` `True` or `False`, and the function never raises. An argument that is not a `str`, such as `None`, `16909060` or `b"1.2.3.4"`, gives `False`.

Run the provided tests with `python3 -m unittest test_visible -v`.
