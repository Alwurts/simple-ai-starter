import { runInDurableObject } from "cloudflare:test";
import {
  getCompactionLimit,
  orgChatContextOverflow,
  resolveOrgChatModel,
} from "@workspace/agent/inference";
import { OrgChat } from "@workspace/agent/org/chat";
import { isCompactionMessage, type Session } from "agents/sessions";
import { MockLanguageModelV3 } from "ai/test";
import { describe, expect, it } from "vitest";
import { env } from "./test-env";

/**
 * D-010 (carried from unit 3 review) — behaviour-level compaction test.
 *
 * OrgChat's compaction triggers are Think built-ins (D-016): `compactAfter`
 * (pre-turn estimate heuristic, from `configureSession`) and
 * `contextOverflow` reactive + proactive — all of which run **this session's
 * registered compaction function via `session.compact()`**. The vitest pool
 * cannot spawn Think agent facets (`ctx.exports` unavailable) nor run a real
 * turn + model, so this test drives the exact seam those paths share: the
 * real OrgChat `configureSession` chain (createCompactFunction +
 * compactAfter) applied to a genuine Sessions store on `SessionHost`, then
 * `session.compact()` with a mock summarizer model.
 *
 * Covered: the contextOverflow/classifier wiring, the compactAfter budget
 * derivation, and the compaction function + overlay read semantics (summary
 * replaces the middle, protected head and recent tail stay verbatim; a
 * within-budget history is left alone). NOT covered: Think's turn loop
 * invoking compact() reactively/proactively (needs a live turn + provider) —
 * verified in `pnpm dev`.
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
function orgChatOverSession(
  session: Session,
  organizationId = "org_test"
): OrgChat {
  const chat = Object.create(OrgChat.prototype) as OrgChat;
  const mutable = chat as unknown as Record<string, unknown>;
  mutable.session = session;
  mutable.env = { AI_GATEWAY_API_KEY: "test-key" };
  mutable.resolvedContextWindow = 200_000;
  mutable.resolveModel = () => MOCK_MODEL;
  // onStart derives the org id from the parent path (a prototype getter on
  // Agent, so it is shadowed with an own property).
  Object.defineProperty(chat, "parentPath", {
    value: [{ className: "OrgAgent", name: organizationId }],
    configurable: true,
  });
  return chat;
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

const SEED_MESSAGES = [
  { marker: "HEAD-0", chars: 400, role: "user" as const },
  { marker: "HEAD-1", chars: 400, role: "assistant" as const },
  { marker: "HEAD-2", chars: 400, role: "user" as const },
  // The middle message that compaction should summarize away (~15k tokens
  // pushes the tail budget back to exactly this message).
  { marker: "MIDDLE-3", chars: 60_000, role: "assistant" as const },
  { marker: "TAIL-4", chars: 20_000, role: "user" as const },
  { marker: "TAIL-5", chars: 20_000, role: "assistant" as const },
];

async function seedHistory(
  session: Session,
  messages = SEED_MESSAGES
): Promise<void> {
  for (const [index, message] of messages.entries()) {
    await session.appendMessage({
      id: `msg_${index}`,
      role: message.role,
      parts: [{ text: bigText(message.chars, message.marker), type: "text" }],
    });
  }
}

describe("OrgChat compaction wiring", () => {
  it("configures Think's built-in overflow triggers on the model's window", () => {
    // Reactive backstop + proactive guard at the resolved model's window
    // (Think compacts proactively at maxInputTokens * 90% headroom). The
    // config itself is a pure function — onStart assigns it verbatim.
    const { contextWindow } = resolveOrgChatModel({
      AI_GATEWAY_API_KEY: "test-key",
    } as unknown as Cloudflare.Env);
    expect(orgChatContextOverflow(contextWindow)).toEqual({
      reactive: true,
      proactive: { maxInputTokens: contextWindow },
    });
    expect(getCompactionLimit(contextWindow)).toBe(
      Math.floor(contextWindow * 0.75)
    );
  });

  it("pairs the reactive backstop with the documented default classifier", async () => {
    const envStub = {
      AI_GATEWAY_API_KEY: "test-key",
    } as unknown as Cloudflare.Env;
    // Class-field initializers (the classifier override) run at
    // construction — no deferral, unlike the auto-wrapped onStart.
    const wiring = await runInDurableObject(
      env.SESSION_HOST.get(env.SESSION_HOST.idFromName("compact-wiring")),
      (_host, state) => {
        const instance = new OrgChat(
          state as unknown as DurableObjectState,
          envStub
        );
        return {
          overflowClassified: instance.classifyChatError(
            new Error("prompt is too long: 250000 tokens > 200000 maximum")
          ),
          otherClassified: instance.classifyChatError(
            new Error("rate limited")
          ),
        };
      }
    );
    expect(wiring.overflowClassified).toBe("context_overflow");
    expect(wiring.otherClassified).toBeUndefined();
  });
});

describe("OrgChat compaction behaviour (in workerd)", () => {
  it("compact() summarizes the middle, keeping the protected head and recent tail", async () => {
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

      // The exact call Think's contextOverflow reactive/proactive paths make.
      await rawSession.compact();
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

  it("leaves a within-budget history alone (compaction function no-ops)", async () => {
    const stub = env.SESSION_HOST.get(
      env.SESSION_HOST.idFromName("compact-skip")
    );

    const history = await runInDurableObject(stub, async (host) => {
      const rawSession = host.session;
      await seedHistory(rawSession, SEED_MESSAGES.slice(0, 2));

      const chat = orgChatOverSession(rawSession);
      chat.configureSession(thinkSessionAdapter(rawSession) as never);

      // Two short messages are inside createCompactFunction's protect-head +
      // keep-recent budget, so compact() declines — exactly what Think's
      // reactive/proactive callers see (a null result means "nothing to do").
      await rawSession.compact();
      return rawSession.getHistory();
    });

    expect(history.find(isCompactionMessage)).toBeUndefined();
    expect(history).toHaveLength(2);
  });
});
