import { OrgChat, OrgSubAgent } from "@workspace/agent/org/chat";
import { describe, expect, it } from "vitest";

/**
 * The skill tool surface. Think merges `activate_skill` /
 * `read_skill_resource` into turns only when `getSkills()` returns sources.
 * OrgChat bundles the example skills; the `delegate` sub-agent must not get
 * them, so it deliberately does not override `getSkills` (Think's default
 * returns none). This pins the class wiring — the tools themselves are added
 * inside Think's turn assembly and are exercised by the live smoke.
 */
describe("skill tool surface", () => {
  it("OrgChat overrides getSkills; the delegate sub-agent does not", () => {
    expect(Object.hasOwn(OrgChat.prototype, "getSkills")).toBe(true);
    expect(Object.hasOwn(OrgSubAgent.prototype, "getSkills")).toBe(false);
  });

  it("registers no skill script runner (run_skill_script stays off)", () => {
    expect(Object.hasOwn(OrgChat.prototype, "getSkillScriptRunner")).toBe(
      false
    );
  });
});
