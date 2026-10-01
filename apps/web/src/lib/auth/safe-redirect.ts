// Control characters and backslashes never belong in an in-app redirect
// target: the URL parser maps `\` to `/` for special schemes (`/\host` →
// `//host`), and stray control characters change how a target is parsed.
// (`\p{Cc}` = the Unicode control category, DEL included.)
const UNSAFE_TARGET_CHARS = /[\p{Cc}\\]/u;

/**
 * The one open-redirect guard for `?redirect=` handling on the auth pages.
 * Parses the target against the current origin with the WHATWG URL parser —
 * the same resolution the browser will do on `location.assign` — and only
 * returns same-origin `pathname + search + hash`; anything else (absolute
 * other-origin URLs, protocol-relative `//host` or `/\host`, custom schemes)
 * falls back.
 */
export function safeRedirectPath(
  target: string | undefined | null,
  fallback = "/"
): string {
  if (!target || UNSAFE_TARGET_CHARS.test(target)) {
    return fallback;
  }
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  let url: URL;
  try {
    url = new URL(target, origin);
  } catch {
    return fallback;
  }
  if (url.origin !== origin || url.origin === "null") {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
