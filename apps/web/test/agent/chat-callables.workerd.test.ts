import { OrgChat } from "@workspace/agent/org/chat";
import { Agent, callable } from "agents";
import { describe, expect, it } from "vitest";

/**
 * `@callable()` works on this repo's classes with the
 * agents() Vite plugin / Babel decorator transform (upstream facets use the
 * decorator too). OrgChat's client-callables go through the decorator and
 * are registered where the framework's `_isCallable` check reads them;
 * `searchMessages` stays deliberately unregistered (parent-only RPC).
 */
class CallableProbe extends Agent<Cloudflare.Env> {
  @callable()
  ping(): string {
    return "pong";
  }
}

describe("OrgChat client callables", () => {
  it("registers the decorator on a scratch class (same transform as the app build)", () => {
    const instance = Object.create(CallableProbe.prototype) as CallableProbe;
    expect(instance.getCallableMethods().has("ping")).toBe(true);
  });

  it("exposes compactNow; searchMessages stays parent-only", () => {
    const instance = Object.create(OrgChat.prototype) as OrgChat;
    const callables = instance.getCallableMethods();
    expect(callables.has("compactNow")).toBe(true);
    expect(callables.has("searchMessages")).toBe(false);
  });

  it("keeps the Think approval callables registered after the rebuild overrides", () => {
    // OrgChat overrides approveExecution/rejectExecution to rebuild the tool
    // set under the approver's connection (per-getTools binding);
    // `@callable()` on the overrides keeps them reachable from the client
    // (nearest decorated declaration wins).
    const instance = Object.create(OrgChat.prototype) as OrgChat;
    const callables = instance.getCallableMethods();
    expect(callables.has("approveExecution")).toBe(true);
    expect(callables.has("rejectExecution")).toBe(true);
    expect(callables.has("pendingExecutions")).toBe(true);
  });
});
