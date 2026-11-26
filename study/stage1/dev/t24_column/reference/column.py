def column_name(index):
    if isinstance(index, bool) or not isinstance(index, int) or index < 1:
        raise ValueError("index must be 1 or more")
    letters = []
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        letters.append(chr(ord("A") + remainder))
    return "".join(reversed(letters))


def column_index(name):
    if not name or any(char not in "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz" for char in name):
        raise ValueError("name must be letters A to Z")
    index = 0
    for char in name.upper():
        index = index * 26 + (ord(char) - ord("A") + 1)
    return index
