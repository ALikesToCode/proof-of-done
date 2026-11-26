import re


def evaluate(text):
    if not text.strip() or not re.fullmatch(r"[0-9+\-*/%() \t]+", text):
        raise ValueError(text)
    try:
        return int(eval(text))
    except ZeroDivisionError:
        raise
    except Exception as error:
        raise ValueError(text) from error
