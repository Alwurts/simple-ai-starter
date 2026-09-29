import type { SkillSource } from "agents/skills";

/**
 * Test stand-in for the Agents Vite plugin's `agents:skills` virtual module.
 *
 * In `vite dev`/`build` the `agents()` plugin (apps/web/vite.config.ts)
 * resolves `agents:skills` to the bundled `SkillSource` built from
 * `packages/agent/src/org/chat/skills/`. Vitest has no plugins from that
 * config, so the workers project aliases the specifier here (vitest.config.ts)
 * to keep tests that transitively import `OrgChat` loadable. It serves an
 * empty catalog — skill *content* is asserted separately by a node test that
 * parses the real SKILL.md file.
 */
const source: SkillSource = {
  fingerprint: "test",
  id: "test-org-chat-skills",
  list: async () => [],
  load: async () => null,
};

export default source;
