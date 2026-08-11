import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// ---------------------------------------------------------------------------
// Workspace stamping. Row-level security scopes every entity to a
// workspace_id, so every record created from the app must carry the signed-in
// user's workspace. AuthContext sets it once after workspace_bootstrap
// resolves; this proxy then stamps create/bulkCreate payloads transparently,
// so no call site needs to know about workspaces.
// ---------------------------------------------------------------------------

let currentWorkspaceId = null;
export const setWorkspaceId = (id) => { currentWorkspaceId = id || null; };
export const getWorkspaceId = () => currentWorkspaceId;

const STAMPED = new Set([
  "Property", "Unit", "Tenant", "Tenancy", "Equipment", "Conversation",
  "Message", "AITriage", "MaintenanceTicket", "Contractor", "ComplianceRecord",
  "Bill", "Transaction", "ActivityEvent", "IntegrationLog", "ShortLetBooking",
  "Task", "RentIncreaseNotice", "PRSRegistration", "ImportTemplate",
  "AppSetting", "WorkspaceInvite",
]);

const withWs = (data) =>
  currentWorkspaceId && data && typeof data === "object" && !data.workspace_id
    ? { ...data, workspace_id: currentWorkspaceId }
    : data;

const entityCache = new Map();
const entitiesProxy = new Proxy({}, {
  get(_, entityName) {
    if (typeof entityName !== "string") return undefined;
    if (!entityCache.has(entityName)) {
      const target = client.entities[entityName];
      if (!target || !STAMPED.has(entityName)) {
        entityCache.set(entityName, target);
      } else {
        entityCache.set(entityName, new Proxy(target, {
          get(t, method) {
            if (method === "create") return (data) => t.create(withWs(data));
            if (method === "bulkCreate") return (list) => t.bulkCreate((list || []).map(withWs));
            const v = t[method];
            return typeof v === "function" ? v.bind(t) : v;
          },
        }));
      }
    }
    return entityCache.get(entityName);
  },
});

export const base44 = new Proxy(client, {
  get(c, key) {
    if (key === "entities") return entitiesProxy;
    const v = c[key];
    return typeof v === "function" ? v.bind(c) : v;
  },
});
