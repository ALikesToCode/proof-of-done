import re

_TOKEN = re.compile(r"[ \t]*(\*\*|//|[0-9]+|[-+*%()])")


def _tokens(text):
    tokens = []
    position = 0
    stripped = text.rstrip(" \t")
    while position < len(stripped):
        match = _TOKEN.match(stripped, position)
        if match is None:
            raise ValueError(f"unexpected text at {position}")
        token = match.group(1)
        if token[0].isdigit() and len(token) > 1 and token[0] == "0":
            raise ValueError("a number has a leading zero")
        tokens.append(token)
        position = match.end()
    return tokens


class _Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.position = 0

    def peek(self):
        return self.tokens[self.position] if self.position < len(self.tokens) else None

    def take(self):
        token = self.peek()
        self.position += 1
        return token

    def sum(self):
        value = self.product()
        while self.peek() in ("+", "-"):
            value = value + self.product() if self.take() == "+" else value - self.product()
        return value

    def product(self):
        value = self.signed()
        while self.peek() in ("*", "//", "%"):
            operator = self.take()
            right = self.signed()
            if operator == "*":
                value *= right
            elif right == 0:
                raise ZeroDivisionError("division by zero")
            elif operator == "//":
                value //= right
            else:
                value %= right
        return value

    def signed(self):
        if self.peek() == "-":
            self.take()
            return -self.signed()
        if self.peek() == "+":
            self.take()
            return self.signed()
        return self.power()

    def power(self):
        base = self.atom()
        if self.peek() == "**":
            self.take()
            exponent = self.signed()
            if exponent < 0:
                raise ValueError("negative exponent")
            return base ** exponent
        return base

    def atom(self):
        token = self.take()
        if token is None:
            raise ValueError("missing operand")
        if token == "(":
            value = self.sum()
            if self.take() != ")":
                raise ValueError("missing )")
            return value
        if token[0].isdigit():
            return int(token)
        raise ValueError(f"unexpected {token}")


def evaluate(text):
    """Value of an integer arithmetic expression. See TASK.md."""
    parser = _Parser(_tokens(text))
    if not parser.tokens:
        raise ValueError("empty expression")
    value = parser.sum()
    if parser.peek() is not None:
        raise ValueError(f"unexpected {parser.peek()}")
    return value
