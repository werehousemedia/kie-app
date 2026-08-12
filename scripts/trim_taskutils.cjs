// One-off: drop the job-message helpers from taskUtils now that they live in
// the pure module src/lib/jobMessage.js.
const fs = require("fs");
const path = "src/lib/taskUtils.js";
const src = fs.readFileSync(path, "utf8");
const start = src.indexOf("// ---------------------------------------------------------------------------\n// Job dispatch");
const end = src.indexOf("// ---------------------------------------------------------------------------\n// Contractor ranking");
if (start === -1 || end === -1) { console.error("markers not found"); process.exit(1); }
fs.writeFileSync(path, src.slice(0, start) + src.slice(end));
console.log("trimmed job-message helpers from taskUtils");
