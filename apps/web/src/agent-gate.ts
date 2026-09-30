import { auth } from "@workspace/auth";
import { getActiveMemberRole } from "@workspace/core/auth";
import { routeAgentRequest } from "agents";

/**
 * The single `/agents/` gate, shared by the production entry (`src/server.ts`)
 * and the test worker entry (`src/workerd-test/worker-entry.ts`) so tests
 * exercise the production code path. Runs inside `routeAgentRequest`'s
 * `onBeforeConnect` / `onBeforeRequest` hooks on the router's own URL parse
 * (agents routing.md › Hooks): the target namespace and instance name come
 * from the parsed route, so double-slash bypasses like `/agents//org-agent/<id>`
 * cannot skip the check.
 */
export async function gateAgentRequest(
  request: Request,
  route: { className: string; name: string }
): Promise<Response | undefined> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (route.className !== "OrgAgent") {
    return new Response("Not found", { status: 404 });
  }
  // Live membership, not the session's active-org stamp (which better-auth
  // only clears on self-removal). The instance name is the organization id.
  const role = await getActiveMemberRole({
    userId: session.user.id,
    organizationId: route.name,
  });
  if (!role) {
    return new Response("Forbidden", { status: 403 });
  }
}

/**
 * Route `/agents/...` through the agents router with the membership gate
 * installed on both the WebSocket-upgrade and plain-HTTP hooks. Returns
 * undefined when the path is not an agent route.
 *
 * No warm-up: the router itself resolves and fetches the named Durable
 * Object (agents routing.md › Request Flow — "Get/create DO by instance
 * ID"), so a separate `getAgentByName` boot only duplicated the wake.
 */
export function routeGatedAgentRequest(
  request: Request,
  env: Cloudflare.Env
): Promise<Response | undefined> {
  return routeAgentRequest(request, env, {
    onBeforeConnect: gateAgentRequest,
    onBeforeRequest: gateAgentRequest,
  });
}
