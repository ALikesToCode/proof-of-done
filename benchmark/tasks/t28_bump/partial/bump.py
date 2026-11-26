def next_version(current, commits):
    major, minor, patch = (int(part) for part in current.split("."))
    text = "\n".join(commits)
    if "!:" in text or "BREAKING CHANGE" in text:
        return f"{major + 1}.0.0"
    if any(message.startswith("feat") for message in commits):
        return f"{major}.{minor + 1}.0"
    if any(message.startswith("fix") for message in commits):
        return f"{major}.{minor}.{patch + 1}"
    return current
