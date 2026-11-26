import fnmatch
import re


def matches(pattern, path):
    regex = fnmatch.translate(pattern.replace("**/", "\x00").replace("**", "\x00"))
    regex = regex.replace("\x00", ".*")
    if "**" not in pattern:
        regex = regex.replace(".*", "[^/]*")
    return re.match(regex, path) is not None
