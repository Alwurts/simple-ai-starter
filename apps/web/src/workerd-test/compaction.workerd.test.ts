import { runInDurableObject } from "cloudflare:test";
import { getCompactionLimit } from "@workspace/agent/inference";
import { OrgChat } from "@workspace/agent/org/chat";
import { isCompactionMessage, type Session } from "agents/sessions";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * D-010 (carried from unit 3 review) — behaviour-level compaction test.
 *
 * Drives the real OrgChat compaction wiring end-to-end against a genuine
 * Sessions store, with a fake model (no network):
 *   `configureSession(session)` (createCompactFunction + compactAfter) and
 *   `maybeCompactByUsage(inputTokens)` (the post-turn real-usage trigger).
 * The session lives on `SessionHost`, a plain DO with the agents `Sessions`
 * capability — the smallest real seam that owns Sessions SQLite.
 *
 * The vitest pool cannot spawn Think agent facets (`ctx.exports` unavailable)
 * and has no model, so what is NOT covered here: Think's own turn loop calling
 * `onChatResponse` → `maybeCompactByUsage`, `syncMessagesFromStorage`
 * broadcasting, and the `compactAfter` pre-turn heuristic (the threshold is
 * read via the same `getCompactionLimit` the test exercises). Those run in
 * `pnpm dev`; the summary-overlay mechanics are the agents SDK's own.
 */

const SUMMARY_TEXT = "COMPACT SUMMARY of the earlier discussion";

/** ~chars/4 is the token estimate, so ~60_000 chars ≈ 15_000 tokens. */
function bigText(chars: number, marker: string): string {
  return `${marker} ${"lorem ipsum dolor sit amet ".repeat(Math.ceil(chars / 28))}`;
}

type MockModelOptions = NonNullable<
  ConstructorParameters<typeof MockLanguageModelV3>[0]
>;

const MOCK_MODEL = new MockLanguageModelV3({
  doGenerate: (async () => ({
    content: [{ type: "text", text: SUMMARY_TEXT }],
    finishReason: "stop",
    usage: {
      inputTokens: {
        total: 10,
        noCache: 10,
        cacheRead: 0,
        cacheWrite: 0,
      },
      outputTokens: { total: 10, text: 10, reasoning: 0 },
    },
    warnings: [],
  })) as unknown as NonNullable<MockModelOptions["doGenerate"]>,
});

/**
 * A bare OrgChat prototype instance whose storage-facing seams are stubbed —
 * same technique as org-chat-context.workerd.test.ts. `session` points at the
 * REAL SessionHost-backed handle; `resolveModel` returns the mock.
 */
function orgChatOverSession(session: Session): OrgChat {
  const chat = Object.create(OrgChat.prototype) as OrgChat;
  const mutable = chat as unknown as Record<string, unknown>;
  mutable.session = session;
  mutable.resolvedContextWindow = 200_000;
  mutable.syncMessagesFromStorage = async () => undefined;
  mutable.resolveModel = () => MOCK_MODEL;
  return chat;
}

/** `maybeCompactByUsage` is private; the test drives it directly. */
function compactByUsage(chat: OrgChat, inputTokens: number): Promise<void> {
  return (
    chat as unknown as {
      maybeCompactByUsage: (tokens: number) => Promise<void>;
    }
  ).maybeCompactByUsage(inputTokens);
}

/**
 * `configureSession` chains three setters; the raw agents Session has
 * `onCompaction`/`compactAfter` but not Think's `onCompactionError`, so the
 * adapter delegates the first two to the real session and no-ops the handler.
 * (The handler is one structuredLog line — uncovered here, exercised by the
 * auto-compaction failure paths in dev.)
 */
function thinkSessionAdapter(raw: Session) {
  const adapter = {
    onCompaction: (fn: Parameters<Session["onCompaction"]>[0]) => {
      raw.onCompaction(fn);
      return adapter;
    },
    onCompactionError: () => adapter,
    compactAfter: (threshold: number) => {
      raw.compactAfter(threshold);
      return adapter;
    },
  };
  return adapter;
}

async function seedHistory(session: Session): Promise<void> {
  const messages = [
    { marker: "HEAD-0", chars: 400, role: "user" as const },
    { marker: "HEAD-1", chars: 400, role: "assistant" as const },
    { marker: "HEAD-2", chars: 400, role: "user" as const },
    // The middle message that compaction should summarize away (~15k tokens
    // pushes the tail budget back to exactly this message).
    { marker: "MIDDLE-3", chars: 60_000, role: "assistant" as const },
    { marker: "TAIL-4", chars: 20_000, role: "user" as const },
    { marker: "TAIL-5", chars: 20_000, role: "assistant" as const },
  ];
  for (const [index, message] of messages.entries()) {
    await session.appendMessage({
      id: `msg_${index}`,
      role: message.role,
      parts: [{ text: bigText(message.chars, message.marker), type: "text" }],
    });
  }
}

describe("OrgChat compaction behaviour (in workerd)", () => {
  it("compacts on high usage: summary replaces the middle, head and recent tail stay", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("compact-usage")
    );

    const history = await runInDurableObject(stub, async (host) => {
      const rawSession = host.session;
      await seedHistory(rawSession);

      const chat = orgChatOverSession(rawSession);
      // The real OrgChat chain: onCompaction(createCompactFunction(mock
      // summarize)) + compactAfter(getCompactionLimit(window)).
      chat.configureSession(thinkSessionAdapter(rawSession) as never);

      await compactByUsage(chat, getCompactionLimit(200_000) + 1);
      return rawSession.getHistory();
    });

    const markers = history.map((message) =>
      message.parts
        .filter((part) => part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join(" ")
    );

    // The middle message was summarized away…
    expect(markers.some((text) => text.includes("MIDDLE-3"))).toBe(false);
    // …the head (first three, protected) and the recent tail survive verbatim…
    expect(markers[0]?.includes("HEAD-0")).toBe(true);
    expect(markers[1]?.includes("HEAD-1")).toBe(true);
    expect(markers[2]?.includes("HEAD-2")).toBe(true);
    expect(markers.at(-2)?.includes("TAIL-4")).toBe(true);
    expect(markers.at(-1)?.includes("TAIL-5")).toBe(true);
    // …and a compaction overlay carrying the fake model's summary sits between them.
    const overlay = history.find(isCompactionMessage);
    expect(overlay).toBeDefined();
    expect(
      overlay?.parts.some(
        (part) => part.type === "text" && part.text?.includes(SUMMARY_TEXT)
      )
    ).toBe(true);
  });
  it("does not compact when usage stays under the limit", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("compact-skip")
    );

    const history = await runInDurableObject(stub, async (host) => {
      const rawSession = host.session;
      await seedHistory(rawSession);

      const chat = orgChatOverSession(rawSession);
      chat.configureSession(thinkSessionAdapter(rawSession) as never);

      await compactByUsage(chat, getCompactionLimit(200_000) - 1);
      return rawSession.getHistory();
    });

    expect(history.find(isCompactionMessage)).toBeUndefined();
    expect(
      history.some((message) =>
        message.parts.some(
          (part) => part.type === "text" && part.text?.includes("MIDDLE-3")
        )
      )
    ).toBe(true);
  });
});
