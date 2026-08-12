#!/usr/bin/env bash
# Temporary verification helper: does an edit to an EXISTING backend function
# reach the deployed runtime? Prints the build marker from the response.
SECRET="$1"
curl -s -X POST "https://kie-app.base44.app/functions/handle_inbound_message" \
  -H "Content-Type: application/json" \
  -H "X-Sync-Secret: $SECRET" \
  -d '{"phone":"07700900999","content":"Build marker check."}' \
  -o /tmp/pipe.json
python3 -c "import json;d=json.load(open('/tmp/pipe.json'));print('build =',repr(d.get('build')),'| err',d.get('error'))"
