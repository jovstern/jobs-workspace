#!/usr/bin/env bash
# Copies the starter template into the current directory and proves the gates pass.
# Existing files are never overwritten. Usage: scaffold.sh <project-name>
set -euo pipefail

NAME="${1:?Usage: scaffold.sh <project-name>}"
if ! [[ "$NAME" =~ ^[a-z0-9][a-z0-9._-]*$ ]]; then
  echo "Project name must be lowercase letters, digits, dots, dashes or underscores." >&2
  exit 1
fi

TEMPLATE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/template"
[ -d .git ] || { echo "Run this from the root of a git repository." >&2; exit 1; }

(cd "$TEMPLATE" && find . -type f) | while read -r file; do
  target="${file#./}"
  if [ "$target" = "gitignore" ]; then
    # Merge rather than skip: an existing .gitignore must still ignore build output.
    touch .gitignore
    while read -r line; do
      grep -qxF "$line" .gitignore || echo "$line" >> .gitignore
    done < "$TEMPLATE/gitignore"
    echo "merge  .gitignore"
    continue
  fi
  if [ -e "$target" ]; then
    echo "skip   $target (already exists)"
    continue
  fi
  mkdir -p "$(dirname "$target")"
  sed "s/__PROJECT_NAME__/$NAME/g" "$TEMPLATE/$file" > "$target"
  echo "create $target"
done

npm install
npx lefthook install
npx playwright install chromium
npm run check
npm run e2e
echo "Scaffold complete: all gates pass."
