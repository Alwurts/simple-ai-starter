import { describe, expect, it } from "vitest";
import { buildOrgHeader } from "./system-prompt";

describe("buildOrgHeader", () => {
  const header = buildOrgHeader({
    id: "org_1",
    name: "Acme",
    slug: "acme",
  });

  it("keeps the section prefix stable for prompt caching", () => {
    const sections = header
      .split("\n")
      .filter((line) => line.startsWith("# "))
      .map((line) => line.slice(2));
    expect(sections).toEqual([
      "Role",
      "Goal",
      "Success",
      "Constraints",
      "Tools",
      "Output",
      "Stop",
    ]);
  });

  it("carries the codemode pause/rejection discipline (round 2)", () => {
    const flat = header.replace(/\s+/g, " ");
    expect(flat).toContain('status: "paused"');
    expect(flat).toContain("one pending approval");
    expect(flat).toContain('status: "rejected"');
    expect(flat).toContain("do not retry it unless the user asks again");
  });

  it("identifies the org once, up front", () => {
    expect(header).toContain("Assistant for Acme (slug: acme, id: org_1)");
  });
});
