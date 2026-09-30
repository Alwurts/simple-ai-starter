import { OrgChat } from "@workspace/agent/org/chat";
import type { WritableContextProvider } from "agents/context";
import { describe, expect, it } from "vitest";

/**
 * Think 0.18 moved prompt context from the `withContext()` /
 * `configureSession()` chain to `configureContext()`. The org memory
 * block is the starter's only context block, and its provider round-trips
 * through the parent `OrgAgent`'s `org_memory` table so every chat in the org
 * shares one memory. This pins the moved wiring: the block is declared by
 * `configureContext()`, is writable (→ `set_context`), and its provider reads
 * and writes the parent's memory — so a second chat in the same org sees what
 * the first wrote.
 *
 * `configureContext()` reads no instance state outside the `getParent` closure,
 * so it runs on a bare prototype instance with a stubbed parent — no live Think
 * DO (which needs a model) is required. The test lives in the workerd project
 * because `org-chat.ts` transitively imports `cloudflare:workers` (via
 * `agents`), which plain node cannot resolve.
 */

interface MemoryParent {
  readOrgMemory: (label: string) => Promise<string | null>;
  writeOrgMemory: (label: string, content: string) => Promise<void>;
}

function fakeOrgAgentParent() {
  const store = new Map<string, string>();
  const readLabels: string[] = [];
  const writes: Array<{ content: string; label: string }> = [];
  const parent: MemoryParent = {
    readOrgMemory: (label) => {
      readLabels.push(label);
      return Promise.resolve(store.get(label) ?? null);
    },
    writeOrgMemory: (label, content) => {
      writes.push({ label, content });
      store.set(label, content);
      return Promise.resolve();
    },
  };
  return { parent, readLabels, store, writes };
}

function orgChatWithParent(getParent: () => Promise<MemoryParent>): OrgChat {
  const instance = Object.create(OrgChat.prototype) as OrgChat;
  (
    instance as unknown as { getParent: () => Promise<MemoryParent> }
  ).getParent = getParent;
  return instance;
}

/**
 * The `org_memory` block `configureContext()` must declare (after the
 * read-only `org` header block).
 */
function orgMemoryBlock(chat: OrgChat) {
  const blocks = chat.configureContext();
  expect(blocks.map((block) => block.label)).toEqual(["org", "org_memory"]);
  const block = blocks[1];
  if (!block) {
    throw new Error("configureContext returned no org_memory block");
  }
  return block;
}

describe("OrgChat org memory via configureContext (think 0.18)", () => {
  it("declares exactly the writable org_memory block", () => {
    const { parent } = fakeOrgAgentParent();
    const chat = orgChatWithParent(() => Promise.resolve(parent));

    const block = orgMemoryBlock(chat);
    expect(block.description).toContain("set_context");
    expect(block.maxTokens).toBe(2000);
    expect(typeof (block.provider as WritableContextProvider)?.set).toBe(
      "function"
    );
  });

  it("prepends a read-only org header block (no set_context on it)", () => {
    const { parent } = fakeOrgAgentParent();
    const chat = orgChatWithParent(() => Promise.resolve(parent));

    const org = chat.configureContext()[0];
    expect(org?.label).toBe("org");
    expect((org?.provider as WritableContextProvider)?.set).toBeUndefined();
    expect(typeof org?.provider?.get).toBe("function");
  });

  it("writes through the provider land in the parent's org_memory", async () => {
    const { parent, writes } = fakeOrgAgentParent();
    const chat = orgChatWithParent(() => Promise.resolve(parent));

    const provider = orgMemoryBlock(chat).provider as WritableContextProvider;
    await provider.set("Ship on Fridays.");

    expect(writes).toEqual([
      { label: "org_memory", content: "Ship on Fridays." },
    ]);
  });

  it("a second chat in the same org reads what the first wrote", async () => {
    const { parent, store } = fakeOrgAgentParent();
    const first = orgChatWithParent(() => Promise.resolve(parent));
    const second = orgChatWithParent(() => Promise.resolve(parent));

    const firstProvider = orgMemoryBlock(first)
      .provider as WritableContextProvider;
    await firstProvider.set("Conventions: pnpm only.");

    const secondProvider = orgMemoryBlock(second)
      .provider as WritableContextProvider;
    const seen = await secondProvider.get();

    expect(seen).toBe("Conventions: pnpm only.");
    expect(store.get("org_memory")).toBe("Conventions: pnpm only.");
  });
});
