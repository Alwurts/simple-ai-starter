import type { RoleName } from "@workspace/auth/access-control";

/** Display label for a stored role key. */
export function roleMessage(role: RoleName): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Administrator";
    case "member":
      return "Operator";
    default: {
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

/**
 * Label for a role string from better-auth data. "operator" = better-auth
 * `member` renamed in UI copy only (no schema change); unknown keys render
 * as-is.
 */
export function roleLabel(role: string): string {
  return role in { owner: 1, admin: 1, member: 1 }
    ? roleMessage(role as RoleName)
    : role;
}
