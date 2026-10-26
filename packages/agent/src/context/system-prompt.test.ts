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

  it("tells the model to run JavaScript with exec under /workspace", () => {
    const flat = header.replace(/\s+/g, " ");
    expect(flat).toContain("`exec`");
    expect(flat).toContain("`ls`");
    expect(flat).toContain("/workspace");
    expect(flat).toContain("cannot call product tools");
    expect(flat).not.toContain('status: "paused"');
    expect(flat).not.toContain("`list`");
    expect(flat).not.toContain("`bash`");
    expect(flat).not.toContain("`execute`");
  });

  it("identifies the org once, up front", () => {
    expect(header).toContain("Assistant for Acme (slug: acme, id: org_1)");
  });

  it("tells the model workspace files are user-visible (chat file panel)", () => {
    const flat = header.replace(/\s+/g, " ");
    expect(flat).toContain(
      "visible to the user read-only in the chat's file panel"
    );
    expect(flat).not.toContain("not visible in the main app UI");
  });
});
