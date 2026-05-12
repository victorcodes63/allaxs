#!/usr/bin/env bash
# Push All_AXS_Backend-main/ from this repo to the standalone backend GitHub repo
# (https://github.com/victorcodes63/All_AXS_Backend-main) using git subtree split.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "Error: run from inside the AllAXS git repository." >&2
  exit 1
fi
cd "$ROOT"

BACKEND_REMOTE="${BACKEND_REMOTE:-backend}"
BACKEND_URL="${BACKEND_URL:-https://github.com/victorcodes63/All_AXS_Backend-main.git}"
PREFIX="All_AXS_Backend-main"
TMP_BRANCH="__tmp_backend_subtree_push"

if ! git remote get-url "$BACKEND_REMOTE" &>/dev/null; then
  echo "Adding git remote '$BACKEND_REMOTE' -> $BACKEND_URL"
  git remote add "$BACKEND_REMOTE" "$BACKEND_URL"
fi

echo "Splitting subtree prefix=$PREFIX ..."
git branch -D "$TMP_BRANCH" 2>/dev/null || true
git subtree split --prefix="$PREFIX" -b "$TMP_BRANCH"

PUSH_ARGS=(git push "$BACKEND_REMOTE" "$TMP_BRANCH:main")
if [[ "${BACKEND_PUSH_FORCE:-}" == "1" ]]; then
  echo "BACKEND_PUSH_FORCE=1: using --force-with-lease"
  PUSH_ARGS+=(--force-with-lease)
fi

if ! "${PUSH_ARGS[@]}"; then
  git branch -D "$TMP_BRANCH" 2>/dev/null || true
  echo >&2
  echo "Push failed. If GitHub's main has unrelated history (first-time sync), run:" >&2
  echo "  BACKEND_PUSH_FORCE=1 $0" >&2
  exit 1
fi

git branch -D "$TMP_BRANCH"
echo "Done. Backend remote: $(git remote get-url "$BACKEND_REMOTE")"
