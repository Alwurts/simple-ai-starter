import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

// Node default origin is `http://localhost` (see safe-redirect.ts); tests
// exercise the guard against that origin.
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

  it("falls back on empty input", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("", "/onboarding")).toBe("/onboarding");
  });
});
