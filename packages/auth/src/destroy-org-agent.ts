import { env } from "cloudflare:workers";

interface OrgAgentDestroyStub {
  destroy: () => Promise<void>;
}

/**
 * Wipe the org's top-level agent after its row is gone.
 *
 * `destroy()` drops every table and then aborts the isolate, so the RPC
 * can reject after the wipe. The caller has already deleted the org, and
 * a thrown abort must not turn that into a failed response.
 */
export async function destroyOrgAgent(organizationId: string): Promise<void> {
  const namespace = env.OrgAgent;
  const stub = namespace.get(
    namespace.idFromName(organizationId)
  ) as unknown as OrgAgentDestroyStub;
  try {
    await stub.destroy();
  } catch {
    // Isolate abort after the wipe. See the comment above.
  }
}
