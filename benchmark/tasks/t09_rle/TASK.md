# Run-length encoding

Implement two functions in `rle.py`.

1. `encode(text)` replaces each run of one repeated character by its length followed by the character. A run of length 1 is written as the character alone. `encode("aaabcc")` is `"3ab2c"`, and `encode("")` is `""`.
2. The text given to `encode` must not contain the digits `0` to `9`. If it does, `ValueError`.
3. `decode(text)` reverses `encode`. `decode("3ab2c")` is `"aaabcc"`.
4. `decode` raises `ValueError` for text that `encode` cannot produce in these ways: a count of 0 or 1 (`"1a"`, `"0a"`), a count with a leading zero (`"02a"`), and a count with no character after it (`"3"`, `"a2"`).
5. Counts can have several digits: `decode("12x")` is twelve `x`.

Run the provided tests with `python3 -m unittest test_visible -v`.
