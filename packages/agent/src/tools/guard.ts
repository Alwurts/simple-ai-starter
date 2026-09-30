import { type Action, can } from "@workspace/auth/access-control";
import { getActiveMemberRole } from "@workspace/core/organization";
import { PERMISSION_DENIED_MESSAGE } from "../constants";
import type { AgentToolsContext } from "../types";

/**
 * RBAC gate for agent write tools. Resolves the connected caller's role for the
 * active organization and throws if `can(action, ...)` is false, so an in-chat
 * "Approve" only executes when the caller is actually allowed to make that edit.
 */
export async function assertCan(
  action: Action,
  ctx: Pick<AgentToolsContext, "userId" | "organizationId">
): Promise<void> {
  const role = await getActiveMemberRole({
    userId: ctx.userId,
    organizationId: ctx.organizationId,
  });
  if (!can(action, { role })) {
    throw new Error(PERMISSION_DENIED_MESSAGE);
  }
}
