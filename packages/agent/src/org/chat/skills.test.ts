import { describe, expect, it } from "vitest";
import raw from "./skills/product-copy/SKILL.md?raw";

/**
 * The one bundled example skill. `OrgChat.getSkills()` returns the
 * `agents:skills` source the Agents Vite plugin builds from
 * `src/org/chat/skills/` (an empty-catalog stub replaces that virtual module
 * under vitest — see apps/web/test/agents-skills-shim.ts), so the contract
 * this test pins is the SKILL.md itself: frontmatter with a name + description
 * (the catalog the model sees) and the memory-first instruction in the body.
 * The file is imported as a string (`?raw`) because packages/agent has no node
 * types, and the no-scripts/no-runner rule is pinned in
 * apps/web/src/workerd-test/chat-skills.workerd.test.ts.
 */

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const NAME_LINE_RE = /^name: product-copy$/m;

function splitFrontmatter(text: string): { body: string; frontmatter: string } {
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    throw new Error("SKILL.md is missing frontmatter");
  }
  return { frontmatter: match[1] ?? "", body: match[2] ?? "" };
}

describe("product-copy skill (bundled via agents:skills)", () => {
  const { body, frontmatter } = splitFrontmatter(raw);

  it("declares name and description for the catalog prompt", () => {
    expect(frontmatter).toMatch(NAME_LINE_RE);
    const description = frontmatter
      .split("\n")
      .find((line) => line.startsWith("description:"))
      ?.slice("description:".length)
      .trim()
      .toLowerCase();
    expect(description).toContain("product description");
  });

  it("tells the model to check the org's shared memory for tone first", () => {
    expect(body).toContain("org_memory");
  });

  it("bundles no script references (script running stays off)", () => {
    expect(raw).not.toContain("scripts/");
  });
});
