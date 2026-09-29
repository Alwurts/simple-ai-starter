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
