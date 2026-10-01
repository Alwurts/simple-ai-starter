import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

const ORIGIN = "https://app.test";

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths, with query and hash", () => {
    expect(safeRedirectPath("/accept-invitation/abc", ORIGIN)).toBe(
      "/accept-invitation/abc"
    );
    expect(safeRedirectPath("/catalog?search=kettle#row-3", ORIGIN)).toBe(
      "/catalog?search=kettle#row-3"
    );
  });

  it("rejects cross-origin and protocol-relative targets", () => {
    expect(safeRedirectPath("//evil.example", ORIGIN)).toBe("/");
    expect(safeRedirectPath("https://evil.example", ORIGIN)).toBe("/");
    expect(safeRedirectPath("http://evil.example/path", ORIGIN)).toBe("/");
  });

  it("rejects backslash tricks the URL parser would treat as scheme-relative", () => {
    // WHATWG maps `\` → `/`, so `/\evil.example` parses as `//evil.example`.
    expect(safeRedirectPath("/\\evil.example", ORIGIN)).toBe("/");
    // The router percent-decodes the search param before this check, so
    // `?redirect=%2F%5Cevil.example` arrives as the literal `/\…` form.
    expect(safeRedirectPath("/\\evil.example", ORIGIN)).toBe("/");
    expect(safeRedirectPath("/\\t/evil.example", ORIGIN)).toBe("/");
    expect(safeRedirectPath("/org\\..\\..\\", ORIGIN)).toBe("/");
  });

  it("rejects control characters anywhere in the target", () => {
    expect(safeRedirectPath("/\t/evil.example", ORIGIN)).toBe("/");
    expect(safeRedirectPath("/catalog\r\n?x=1", ORIGIN)).toBe("/");
    expect(safeRedirectPath("/\u0000catalog", ORIGIN)).toBe("/");
  });

  it("rejects custom schemes", () => {
    expect(safeRedirectPath("javascript:alert(1)", ORIGIN)).toBe("/");
    expect(safeRedirectPath("data:text/html,<b>x</b>", ORIGIN)).toBe("/");
  });

  it("falls back on empty input", () => {
    expect(safeRedirectPath(undefined, ORIGIN)).toBe("/");
    expect(safeRedirectPath("", ORIGIN, "/onboarding")).toBe("/onboarding");
  });
});
