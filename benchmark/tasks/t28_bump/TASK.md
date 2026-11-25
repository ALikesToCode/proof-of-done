# Next version from commit messages

Implement `next_version(current, commits)` in `bump.py`. `current` is a version `MAJOR.MINOR.PATCH` of non-negative integers without leading zeros. `commits` is a list of commit messages. The result is the next version as a `str`.

## Reading a commit

1. The first line of a message is its header. A header counts only in the form `type: text` or `type(scope): text`, where `type` is lower-case letters, `scope` is anything but parentheses and is not empty, and exactly one space follows the colon. A header in another form does not count at all.
2. A `!` right before the colon marks a breaking change: `feat!: x`, `fix(api)!: x`.
3. A line after the header that starts with `BREAKING CHANGE: ` or `BREAKING-CHANGE: ` (upper case, at the start of the line) also marks a breaking change, for a commit whose header counts.
4. Type `feat` is a feature and type `fix` is a fix. Other types (`docs`, `chore`, ...) change the version only when they are breaking.

## The bump

5. The strongest change among all commits decides: breaking, then feature, then fix. With none of them, the result is `current` unchanged.
6. From 1.0.0 on: breaking gives `MAJOR+1.0.0`, a feature `MAJOR.MINOR+1.0`, a fix `MAJOR.MINOR.PATCH+1`.
7. Below 1.0.0 (MAJOR is 0): breaking gives `0.MINOR+1.0`, and a feature or a fix gives `0.MINOR.PATCH+1`.
8. A `current` that is not a valid version raises `ValueError`.

Run the provided tests with `python3 -m unittest test_visible -v`.
