import type { RoleName } from "@workspace/auth/access-control";

/**
 * English role labels — the one role-label map. `member` surfaces as
 * "Operator", a copy-only rename; the stored value remains `member`.
 */
export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Owner",
  admin: "Administrator",
  member: "Operator",
};

/** Label for a known role key. */
export function roleMessage(role: RoleName): string {
  return ROLE_LABELS[role];
}

/**
 * Label for a role string from better-auth data. Unknown keys render as-is.
 */
export function roleLabel(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as RoleName] : role;
}
