import { createFetchTools } from "@cloudflare/think/tools/fetch";
import type { ToolSet } from "ai";

/**
 * The `FETCH_ALLOWED_HOSTS` allowlist for Think's read-only fetch tool.
 * The env var is a comma-separated list of hostnames; with it empty
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

/**
 * The fetch tools for a raw `FETCH_ALLOWED_HOSTS` value: `{}` (tool absent —
 * not an empty allowlist) when the value is empty/unset, otherwise Think's
 * read-only `fetch_url` limited to the listed hosts. Pure — unit-tested.
 */
export function fetchToolsForEnv(raw: string | undefined): ToolSet {
  const hosts = parseFetchAllowedHosts(raw);
  if (hosts.length === 0) {
    return {};
  }
  return createFetchTools({ allowlist: fetchAllowlistForHosts(hosts) });
}
