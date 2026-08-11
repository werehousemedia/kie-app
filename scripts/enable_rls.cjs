// One-off migration: add workspace row-level security to every core entity.
// - read: your workspace's records, plus demo records (the shared example
//   portfolio every account can view), plus the platform admin failsafe.
// - create/update/delete: your workspace only (plus admin failsafe).
// The admin clause keeps the app owner from ever locking themselves out.
const fs = require("fs");

const WS_MATCH = { "data.workspace_id": "{{user.data.workspace_id}}" };
const ADMIN = { user_condition: { role: "admin" } };
const WRITE_RULE = { $or: [WS_MATCH, ADMIN] };

const DEMO_SHARED = [
  "Property", "Unit", "Tenant", "Tenancy", "Equipment", "Conversation",
  "Message", "AITriage", "MaintenanceTicket", "ComplianceRecord", "Bill",
  "Transaction", "ActivityEvent", "ShortLetBooking", "Task",
  "RentIncreaseNotice", "PRSRegistration",
];
const WORKSPACE_ONLY = [
  "Contractor", "IntegrationLog", "ImportTemplate", "AppSetting", "WorkspaceInvite",
];

function apply(name, demoShared) {
  const path = "base44/entities/" + name + ".jsonc";
  const schema = JSON.parse(fs.readFileSync(path, "utf8"));
  const readOr = demoShared
    ? [WS_MATCH, { "data.is_demo": true }, ADMIN]
    : [WS_MATCH, ADMIN];
  schema.rls = {
    read: { $or: readOr },
    create: WRITE_RULE,
    update: WRITE_RULE,
    delete: WRITE_RULE,
  };
  fs.writeFileSync(path, JSON.stringify(schema, null, 2) + "\n");
  console.log("rls: " + name + (demoShared ? " (demo-shared read)" : ""));
}

for (const n of DEMO_SHARED) apply(n, true);
for (const n of WORKSPACE_ONLY) apply(n, false);
