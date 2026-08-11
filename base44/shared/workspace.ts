// Workspace stamping for service-role writes. Backend functions bypass
// row-level security, so anything they create MUST carry a workspace_id or it
// will be invisible to every non-admin member of the workspace it belongs to.
// Wrap the entities client once with the workspace resolved from the anchor
// record (import template, tenant, property, …) and every create/bulkCreate
// gets stamped transparently.

// The app owner's original portfolio — used when no anchor record exists yet
// (engine settings, webhook logs) and as the safety fallback.
export const WS_FALLBACK = "ws_kie_main";

const stamp = (data: any, workspaceId: string) =>
  data && typeof data === "object" && !data.workspace_id
    ? { ...data, workspace_id: workspaceId }
    : data;

export function stampEntities<T extends object>(entities: T, workspaceId: string): T {
  const ws = workspaceId || WS_FALLBACK;
  return new Proxy(entities, {
    get(t: any, name) {
      const target = t[name as string];
      if (!target || typeof name !== "string" || typeof target !== "object") return target;
      return new Proxy(target, {
        get(e: any, method) {
          if (method === "create") return (data: any) => e.create(stamp(data, ws));
          if (method === "bulkCreate")
            return (list: any[]) => e.bulkCreate((list || []).map((d) => stamp(d, ws)));
          const v = e[method as string];
          return typeof v === "function" ? v.bind(e) : v;
        },
      });
    },
  }) as T;
}
