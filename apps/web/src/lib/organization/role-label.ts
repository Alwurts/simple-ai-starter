import type { RoleName } from "@workspace/auth/access-control";

/**
 * English role labels — the one role-label map. Plain words, keyed by the
 * value stored in `member.role`.
 */
export const ROLE_LABELS: Record<RoleName, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function roleMessage(role: RoleName): string {
  return ROLE_LABELS[role];
}

export function roleLabel(role: string): string {
  return role in ROLE_LABELS ? ROLE_LABELS[role as RoleName] : role;
}
