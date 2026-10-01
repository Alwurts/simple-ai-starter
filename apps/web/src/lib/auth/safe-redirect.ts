/**
 * The one open-redirect guard for `?redirect=` handling on the auth pages:
 * only same-origin absolute paths survive (`//host` and schemes fall back).
 */
export function safeRedirectPath(
  target: string | undefined | null,
  fallback = "/"
): string {
  return target?.startsWith("/") && !target.startsWith("//")
    ? target
    : fallback;
}
