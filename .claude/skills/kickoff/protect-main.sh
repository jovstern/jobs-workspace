#!/usr/bin/env bash
# Protects main: changes only through a pull request, CI and the demo check must pass,
# and the rule applies to the repository owner too. Usage: protect-main.sh <owner/repo>
set -euo pipefail

REPO="${1:?Usage: protect-main.sh <owner/repo>}"

gh api -X PUT "repos/$REPO/branches/main/protection" --input - <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["check", "demo"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0 },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
echo "main is protected on $REPO"
