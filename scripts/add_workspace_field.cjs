// One-off migration helper: add workspace_id to every core entity schema.
// Run from the app root: node scripts/add_workspace_field.cjs
const fs = require("fs");
const ENTITIES = [
  "Property", "Unit", "Tenant", "Tenancy", "Equipment", "Conversation",
  "Message", "AITriage", "MaintenanceTicket", "Contractor", "ComplianceRecord",
  "Bill", "Transaction", "ActivityEvent", "IntegrationLog", "ShortLetBooking",
  "Task", "RentIncreaseNotice", "PRSRegistration", "ImportTemplate", "AppSetting",
];
for (const name of ENTITIES) {
  const path = "base44/entities/" + name + ".jsonc";
  const schema = JSON.parse(fs.readFileSync(path, "utf8"));
  if (!schema.properties.workspace_id) {
    schema.properties.workspace_id = {
      type: "string",
      description: "Workspace this record belongs to. Row-level security scopes reads and writes to the user's workspace.",
    };
    fs.writeFileSync(path, JSON.stringify(schema, null, 2) + "\n");
    console.log("added: " + name);
  } else {
    console.log("skip: " + name);
  }
}
