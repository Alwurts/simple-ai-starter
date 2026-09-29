/**
 * The `FETCH_ALLOWED_HOSTS` allowlist for Think's read-only fetch tool
 * (D-010). The env var is a comma-separated list of hostnames; with it empty
 * or unset the fetch tool must not exist at all, so `getTools()` only calls
 * `createFetchTools` when this parses to at least one host.
 */

/**
 * Parse the raw env value into hostnames. Whitespace-tolerant; empty or unset
 * yields `[]`. Entries are validated loosely here — Think normalizes and
 * blocks private/loopback targets per request, so an odd entry simply never
 * matches.
 */
export function parseFetchAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);
}

/**
 * Turn hostnames into `createFetchTools` allowlist entries. A bare origin
 * (`https://example.com`) matches that origin and every subpath — hostname
 * entries are whole-host grants by design.
 */
export function fetchAllowlistForHosts(hosts: string[]): string[] {
  return hosts.map((host) => `https://${host}`);
}
