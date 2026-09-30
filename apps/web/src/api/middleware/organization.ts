import type { Action } from "@workspace/auth/access-control";
import { can } from "@workspace/auth/access-control";
import { getActiveMemberRole } from "@workspace/core/auth";
import type { Context, Next } from "hono";
import type { HonoContextWithAuthAndOrg } from "../types";

/**
 * Org scope AND live membership: resolves the caller's `member` row for the
 * session's active organization and 403s when there is none. better-auth only
 * clears `activeOrganizationId` on self-removal, so a member removed by an
 * admin keeps an active-org session — the stored role (not the session stamp)
 * is the source of truth for access.
 *
 * Also stashes the resolved role on the context so `requirePermission` doesn't
 * re-query it.
 */
export const requireActiveOrg = async (
  c: Context<HonoContextWithAuthAndOrg>,
  next: Next
) => {
  const user = c.get("user");
  const session = c.get("session");
  if (!session?.activeOrganizationId) {
    return c.json({ error: "No active organization" }, 403);
  }
  const role = await getActiveMemberRole({
    userId: user.id,
    organizationId: session.activeOrganizationId,
  });
  if (!role) {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("memberRole", role);
  await next();
};

/**
 * Server-side RBAC guard — the single decision point for gating an org-protected
 * route. Reads the role `requireActiveOrg` resolved and 403s before the handler
 * runs when `can(action, ...)` is false. Closes the gap where any member could
 * call any org-protected endpoint.
 *
 * Use after requireActiveOrg, scoped to the gated route(s):
 *   routes.post("/:id", requirePermission("catalog:write"), handler)
 */
export const requirePermission =
  (action: Action) =>
  async (c: Context<HonoContextWithAuthAndOrg>, next: Next) => {
    if (!can(action, { role: c.get("memberRole") })) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  };
