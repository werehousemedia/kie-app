// One-off: replace the inlined iCal parser in sync_short_let_ical with the
// shared, unit-tested module. Run once from the app root, then delete.
const fs = require("fs");
const path = "base44/functions/sync_short_let_ical/entry.ts";
const src = fs.readFileSync(path, "utf8");

const startMarker = "type ParsedEvent = {";
const endMarker = "const BLOCKED_PATTERNS = /not available|blocked|closed/i;\n";
const start = src.indexOf(startMarker);
const end = src.indexOf(endMarker);
if (start === -1 || end === -1) {
  console.error("markers not found — file already changed?");
  process.exit(1);
}
const out =
  src.slice(0, start) +
  src.slice(end + endMarker.length);

const withImport = out.replace(
  'import { WS_FALLBACK } from "../../shared/workspace.ts";',
  'import { WS_FALLBACK } from "../../shared/workspace.ts";\nimport { parseIcs, BLOCKED_PATTERNS } from "../../shared/icalParse.ts";',
);
fs.writeFileSync(path, withImport);
console.log("trimmed", startMarker, "->", endMarker.trim());
