import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

// The helper's origin is `http://localhost` in node (window is undefined);
// tests exercise the guard against it.
const NODE_ORIGIN = "http://localhost";
const OTHER_ORIGIN = "https://evil.example";

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths, with query and hash", () => {
    expect(safeRedirectPath("/accept-invitation/abc")).toBe(
      "/accept-invitation/abc"
    );
    expect(safeRedirectPath("/catalog?search=kettle#row-3")).toBe(
      "/catalog?search=kettle#row-3"
    );
  });

  it("keeps an absolute URL that resolves to the current origin", () => {
    expect(safeRedirectPath("http://localhost/catalog")).toBe("/catalog");
  });

  it("rejects cross-origin and protocol-relative targets", () => {
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath(OTHER_ORIGIN)).toBe("/");
    expect(safeRedirectPath("http://evil.example/path")).toBe("/");
  });

  it("rejects backslash tricks the URL parser would treat as scheme-relative", () => {
    // WHATWG maps `\` → `/`, so `/\evil.example` parses as `//evil.example`.
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    // The router percent-decodes the search param before this check, so
    // `?redirect=%2F%5Cevil.example` arrives as the literal `/\…` form.
    expect(safeRedirectPath("/\\evil.example")).toBe("/");
    expect(safeRedirectPath("/\\t/evil.example")).toBe("/");
    expect(safeRedirectPath("/org\\..\\..\\")).toBe("/");
  });

  it("rejects control characters anywhere in the target", () => {
    expect(safeRedirectPath("/\t/evil.example")).toBe("/");
    expect(safeRedirectPath("/catalog\r\n?x=1")).toBe("/");
    expect(safeRedirectPath("/\u0000catalog")).toBe("/");
  });

  it("rejects custom schemes", () => {
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath("data:text/html,<b>x</b>")).toBe("/");
  });

  it("rejects dot-segment paths that resolve to a // leading output", () => {
    // The input URL parses same-origin (the dot segment collapses), but the
    // returned `//evil.example` re-parses standalone as protocol-relative.
    expect(safeRedirectPath("/.//evil.example")).toBe("/");
    expect(safeRedirectPath("/..//evil.example")).toBe("/");
    // WHATWG treats %2e as a dot segment.
    expect(safeRedirectPath("/%2e//evil.example")).toBe("/");
  });

  it("falls back on empty input", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("", "/onboarding")).toBe("/onboarding");
  });

  it("round-trips every kept result to the same origin when re-parsed standalone", () => {
    const kept = [
      "/accept-invitation/abc",
      "/catalog?search=kettle#row-3",
      "http://localhost/catalog",
      "/org//nested/path",
      "/",
      safeRedirectPath("//evil.example"),
      safeRedirectPath("/.//evil.example"),
      safeRedirectPath(undefined, "/onboarding"),
    ];
    for (const result of kept) {
      const reparsed = new URL(result, NODE_ORIGIN);
      expect(reparsed.origin).toBe(NODE_ORIGIN);
      expect(result.startsWith("//")).toBe(false);
    }
  });
});
