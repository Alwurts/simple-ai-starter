import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeRedirectPath("/accept-invitation/abc")).toBe(
      "/accept-invitation/abc"
    );
    expect(safeRedirectPath("/catalog?search=kettle")).toBe(
      "/catalog?search=kettle"
    );
  });

  it("falls back on open redirects", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("javascript:alert(1)")).toBe("/");
    expect(safeRedirectPath(undefined)).toBe("/");
    expect(safeRedirectPath("", "/onboarding")).toBe("/onboarding");
  });
});
