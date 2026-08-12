#!/usr/bin/env bash
# Temporary verification helper: fire one inbound message through the live
# pipeline and print just the conversation id, so we can inspect what the
# function wrote.
SECRET="$1"
curl -s -X POST "https://kie-app.base44.app/functions/handle_inbound_message" \
  -H "Content-Type: application/json" \
  -H "X-Sync-Secret: $SECRET" \
  -d '{"phone":"07700900999","content":"Third check: front door lock is stiff."}' \
  -o /tmp/pipe.json
python3 -c "import json;d=json.load(open('/tmp/pipe.json'));print('conv',d.get('conversation_id'),'| err',d.get('error'))"
