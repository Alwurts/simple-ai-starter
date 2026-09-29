import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D-010 — the one bundled example skill. `OrgChat.getSkills()` returns the
 * `agents:skills` source the Agents Vite plugin builds from
 * `src/org/chat/skills/` (an empty-catalog stub replaces that virtual module
 * under vitest — see apps/web/test/agents-skills-shim.ts), so the contract
 * this test pins is the SKILL.md itself: frontmatter with a name + description
 * (the catalog the model sees), the memory-first instruction in the body, and
 * no `scripts/` directory — the starter never wires `getSkillScriptRunner`, so
 * `run_skill_script` stays unregistered.
 *
 * The frontmatter shape is checked with the plugin's own split (--- yaml ---,
 * then body) rather than `agents/skills`' parser, whose barrel import pulls
 * `cloudflare:workers` and cannot load in the node test project.
 */

const skillDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "skills",
  "product-copy"
);

const raw = readFileSync(join(skillDir, "SKILL.md"), "utf8");

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

  it("bundles no scripts (run_skill_script stays unregistered)", () => {
    expect(readdirSync(skillDir).sort()).toEqual(["SKILL.md"]);
  });
});
