#!/usr/bin/env bash
# Temporary verification helper: is a named backend function live on the
# published host vs the sandbox host? Distinguishes "deployed" from "unknown"
# by comparing against a name that definitely does not exist.
PROD="https://kie-app.base44.app/functions"
for f in send_whatsapp zz_no_such_fn_abc; do
  code=$(curl -s -o /tmp/out.$f -w "%{http_code}" -X POST "$PROD/$f" -H "Content-Type: application/json" -d '{}')
  printf "%s -> %s | %s\n" "$f" "$code" "$(head -c 70 /tmp/out.$f | tr -d '\n')"
done
