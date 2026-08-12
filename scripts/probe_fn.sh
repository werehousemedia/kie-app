#!/usr/bin/env bash
# Temporary helper: try to force a redeploy of the existing backend functions
# whose source has changed, then report what the CLI said.
cd /app || exit 1
echo "--- whoami ---"
timeout 60 npx --yes base44@0.1.8 whoami 2>&1 | head -5
echo "--- functions list ---"
timeout 90 npx --yes base44@0.1.8 functions list --app-id 6a79fc5fc156dcc6d62c30ca 2>&1 | head -20
