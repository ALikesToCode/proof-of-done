# The image of the agent's sandbox and of the hidden checks. No network is needed at run time.
FROM python:3.12-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir pytest==8.3.4 \
    && git config --system user.name "Dev" && git config --system user.email "dev@example.invalid" \
    && git config --system init.defaultBranch main && git config --system --add safe.directory '*'
WORKDIR /workspace
