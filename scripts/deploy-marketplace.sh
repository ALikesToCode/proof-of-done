#!/usr/bin/env bash
# Deploys the committed tree to the Marketplace registration of Proof of Done.
#
# The app has two Forge registrations that run the same code. manifest.yml holds the id
# of the first, which people install from a link. Forge turns link sharing off for an app
# that was submitted for a Marketplace listing, so the listing has a registration of its own.
#
# `forge deploy` reads the app id from manifest.yml and has no flag to override it. This
# script exports HEAD to a temporary folder, swaps the id in that copy and deploys from
# there. The manifest in the repository is never touched.
#
# Usage: scripts/deploy-marketplace.sh [environment] [more arguments for forge deploy]
#   scripts/deploy-marketplace.sh
#   scripts/deploy-marketplace.sh staging
#   scripts/deploy-marketplace.sh production --approve MAJOR_VERSION_RULE
set -euo pipefail

MARKETPLACE_APP_ID="${MARKETPLACE_APP_ID:-8e9618ee-0af4-4f2a-95af-436f5d28f0b9}"
environment="${1:-production}"
if [ "$#" -gt 0 ]; then shift; fi

root="$(git rev-parse --show-toplevel)"
if [ -n "$(git -C "$root" status --porcelain --untracked-files=no)" ]; then
  echo "The working tree has uncommitted changes. This script deploys HEAD, so commit them first." >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
git -C "$root" archive HEAD | tar -x -C "$work"

ari="ari:cloud:ecosystem::app/$MARKETPLACE_APP_ID"
sed -E "s|^(  id: )ari:cloud:ecosystem::app/.*$|\1$ari|" "$work/manifest.yml" > "$work/manifest.yml.new"
mv "$work/manifest.yml.new" "$work/manifest.yml"
if ! grep -qxF "  id: $ari" "$work/manifest.yml"; then
  echo "Could not write the app id into the copy of manifest.yml." >&2
  exit 1
fi

echo "Deploying commit $(git -C "$root" rev-parse --short HEAD) to $environment of app $MARKETPLACE_APP_ID"
cd "$work"
npm ci --no-audit --no-fund
forge deploy --non-interactive -e "$environment" "$@"
