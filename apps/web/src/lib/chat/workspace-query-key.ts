/**
 * Root of every workspace query key: `[orgId, "workspace", …]`. Org-scoped so
 * an org switch can never serve another org's tree; the OrgAgent's
 * `workspace-change` broadcast invalidates this prefix. Lives in `lib/chat/`
 * because both the connection (invalidating) and the query hooks (keying)
 * need it.
 */
export const workspaceQueryKey = (organizationId: string) =>
  [organizationId, "workspace"] as const;
