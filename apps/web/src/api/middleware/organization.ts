import type { Action } from "@workspace/auth/access-control";
import { can } from "@workspace/auth/access-control";
import { getActiveMemberRole } from "@workspace/core/auth";
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";
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
    throw new HTTPException(403, { message: "No active organization" });
  }
  const role = await getActiveMemberRole({
    userId: user.id,
    organizationId: session.activeOrganizationId,
  });
  if (!role) {
    throw new HTTPException(403, {
      message: "You are not a member of this organization",
    });
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
      throw new HTTPException(403, {
        message: `Missing permission: ${action}`,
      });
    }
    await next();
  };
