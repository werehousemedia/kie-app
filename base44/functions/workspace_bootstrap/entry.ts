// Assigns every authenticated user to exactly one workspace — the keystone of
// row-level security. Runs on app load (AuthContext) and is the ONLY writer of
// User.workspace_id / workspace_role (field-level RLS blocks auth.updateMe):
//   1. already assigned → return it (never reassigns);
//   2. pending WorkspaceInvite for their email → join that workspace with the
//      invited role;
//   3. platform admin (the app owner) → owner of the main KIE workspace;
//   4. anyone else → a fresh, empty workspace of their own.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const MAIN_WORKSPACE = "ws_kie_main";

type Rec = Record<string, any>;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = (await base44.auth.me().catch(() => null)) as Rec | null;
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const sr = base44.asServiceRole.entities;

    const existingWs = user.workspace_id || user.data?.workspace_id;
    if (existingWs) {
      return Response.json({
        workspace_id: existingWs,
        role: user.workspace_role || user.data?.workspace_role || "owner",
      });
    }

    const email = String(user.email || "").toLowerCase();
    let workspace_id: string;
    let role: string;

    const invites: Rec[] = email
      ? await sr.WorkspaceInvite.filter({ email, status: "pending" })
      : [];
    if (invites[0]) {
      workspace_id = invites[0].workspace_id;
      role = invites[0].role === "viewer" ? "viewer" : "editor";
      await sr.WorkspaceInvite.update(invites[0].id, {
        status: "accepted",
        accepted_at: new Date().toISOString(),
      });
    } else if (user.role === "admin") {
      workspace_id = MAIN_WORKSPACE;
      role = "owner";
    } else {
      workspace_id = `ws_${user.id}`;
      role = "owner";
    }

    await sr.User.update(user.id, { workspace_id, workspace_role: role });

    return Response.json({ workspace_id, role });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
