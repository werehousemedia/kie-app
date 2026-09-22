// Temporary capability probe - safe to delete.
export default async function (req: Request): Promise<Response> {
  return Response.json({ ok: true, build: "probe-2" });
}
