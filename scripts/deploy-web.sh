#!/usr/bin/env bash
# Deploy the Next.js web app (All_AXS_Web-main) to Vercel production.
#
# IMPORTANT: Run from the monorepo root (AllAXS/), NOT from All_AXS_Web-main/.
# The Vercel project "allaxs" has Root Directory = All_AXS_Web-main. Deploying
# from inside that folder makes Vercel look for All_AXS_Web-main/All_AXS_Web-main
# and fails with a double-path error.
#
# Usage (from anywhere inside this git repo):
#   ./scripts/deploy-web.sh
#   ./scripts/deploy-web.sh --preview
#
# Requires: vercel CLI logged in (`vercel login`), `.vercel/project.json` at repo root.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "Error: run from inside the AllAXS git repository." >&2
  exit 1
fi
cd "$ROOT"

if [[ ! -f ".vercel/project.json" ]]; then
  echo "Error: missing .vercel/project.json at repo root." >&2
  echo "Link once from here: cd \"$ROOT\" && vercel link" >&2
  exit 1
fi

if [[ ! -d "All_AXS_Web-main" ]]; then
  echo "Error: All_AXS_Web-main/ not found under $ROOT" >&2
  exit 1
fi

TARGET="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  TARGET=""
  shift || true
fi

echo "Deploying web app from monorepo root (Vercel root dir: All_AXS_Web-main) ..."
vercel deploy $TARGET --yes "$@"

echo "Done. Production: https://allaxs.vercel.app (if aliased)"
