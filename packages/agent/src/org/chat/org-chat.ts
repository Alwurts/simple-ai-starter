import bundledSkills from "agents:skills";
import type { WorkspaceFsLike } from "@cloudflare/shell";
import {
  defaultContextOverflowClassifier,
  type Session,
  type SkillSource,
  Think,
  type TurnContext,
} from "@cloudflare/think";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
import { auth } from "@workspace/auth";
import { errorMessage, structuredLog } from "@workspace/log";
import {
  type Connection,
  type ConnectionContext,
  callable,
  getCurrentAgent,
} from "agents";
import { agentTool } from "agents/agent-tools";
import type { ContextConfig } from "agents/context";
import { createCompactFunction } from "agents/sessions";
import { generateText, type LanguageModel, type ToolSet } from "ai";
import { z } from "zod";
import { PERMISSION_DENIED_MESSAGE } from "../../constants";
import { buildOrgContext } from "../../context/assemble";
import {
  getOrgAgentDisplayTools,
  getOrgAgentTools,
} from "../../in-app/compose-org-tools";
import {
  gateChatAttachments,
  getCompactionLimit,
  orgChatContextOverflow,
  type ResolvedOrgChatModel,
  resolveOrgChatModel,
} from "../../inference/chat-models";
import type { ChatMessageHit } from "../../types";
import { resolveTurnUserId } from "../bootstrap";
import { OrgAgent } from "../org-agent";
import { fetchToolsForEnv } from "./fetch-allowlist";
import { OrgMemoryProvider } from "./org-memory-provider";
import { OrgSubAgent } from "./org-sub-agent";
import { SEARCH_MAX_HITS_PER_CHAT, snippetAround } from "./search";
import { SharedWorkspace } from "./shared-workspace";

type OrgAgentParent = Pick<
  OrgAgent,
  "readOrgMemory" | "writeOrgMemory" | "touchChat"
>;

/**
 * Retained agent-tool runs (the `delegate` child facets and their run rows)
 * older than this are swept. Matches the agents docs' example retention.
 */
const AGENT_TOOL_RUN_RETENTION_MS = 7 * 24 * 60 * 60_000;

export class OrgChat extends Think<Cloudflare.Env> {
  override maxSteps = 50;

  override workspace: WorkspaceFsLike = new SharedWorkspace(this);

  private resolvedModel: ResolvedOrgChatModel | undefined;

  /**
   * Env-driven model resolution (id, window, capabilities), memoised. Lazy —
   * not an onStart-assigned field — because Think runs `configureSession`
   * during its own startup, *before* the subclass `onStart`
   * (think lifecycle-hooks.md: configureSession fires "once during onStart";
   * the wrapped startup awaits it ahead of `_onStart`), so a field set in
   * onStart is undefined exactly when `compactAfter` reads it — the NaN
   * budget that made Sessions auto-compact on every append.
   */
  private get resolved(): ResolvedOrgChatModel {
    this.resolvedModel ??= resolveOrgChatModel(this.env);
    return this.resolvedModel;
  }

  private get organizationId(): string {
    return this.requireOrganizationId();
  }

  override onStart(): void {
    // Warm the resolution here (same fail-fast on a missing provider key as
    // before) and set the turn-time overflow config — contextOverflow is only
    // read during turns, so onStart assignment is fine for it.
    this.contextOverflow = orgChatContextOverflow(this.resolved.contextWindow);
  }

  private getParent(): Promise<OrgAgentParent> {
    return this.parentAgent(OrgAgent);
  }

  private requireOrganizationId(): string {
    const organizationId = this.parentPath.at(-1)?.name;
    if (!organizationId) {
      throw new Error(`OrgChat ${this.name}: missing parent OrgAgent name`);
    }
    return organizationId;
  }

  /**
   * Identify the connection for the transcript's sake (state stamp survives
   * hibernation) and close unauthenticated sockets. The security boundary is
   * the Worker gate (apps/web/src/agent-gate.ts) plus the per-turn/per-
   * approval `getTools` binding below; onConnect is never the acting-user
   * source — every member's connection fires it.
   */
  override async onConnect(
    connection: Connection,
    ctx: ConnectionContext
  ): Promise<void> {
    const session = await auth.api.getSession({
      headers: ctx.request.headers,
    });
    const userId = session?.user?.id;
    if (!userId) {
      connection.close(1008, "unauthenticated");
      return;
    }
    // Survive DO hibernation (onConnect does not re-run on wake).
    connection.setState({ userId });
  }

  override getModel(): LanguageModel {
    return this.resolved.model;
  }

  /**
   * The bundled example skills. `agents:skills` is resolved by the
   * Agents Vite plugin the app already runs (apps/web/vite.config.ts) to the
   * `skills/` directory next to this file — currently one skill,
   * `product-copy`. Think merges the catalog into the system prompt and
   * exposes `activate_skill` / `read_skill_resource` on OrgChat turns only;
   * `OrgSubAgent` does not override `getSkills`, so `delegate` gets none.
   * Script running stays off: no `getSkillScriptRunner`, so `run_skill_script`
   * is never registered.
   */
  override getSkills(): SkillSource[] {
    return [bundledSkills];
  }

  /**
   * Prompt blocks (think 0.18 `configureContext`). The read-only `org` block
   * carries the per-org header (org name, member, product stats) — always-on
   * instructions belong in a context block, not a per-turn `beforeTurn`
   * override, so Think can freeze, persist and cache the assembled prompt.
   * The writable `org_memory` block follows it: the model gets `set_context`
   * to update it, and the provider round-trips through the parent `OrgAgent`'s
   * `org_memory` table so every chat in the org shares one memory.
   */
  override configureContext(): ContextConfig[] {
    return [
      {
        label: "org",
        provider: {
          get: async () => {
            const { header } = await buildOrgContext(
              this.requireOrganizationId()
            );
            return header;
          },
        },
      },
      {
        label: "org_memory",
        description:
          "Shared, persistent facts about this organization — conventions, " +
          "policies, recurring issues. Visible to every chat. Use `set_context` " +
          "to update when you learn something worth remembering.",
        maxTokens: 2000,
        provider: new OrgMemoryProvider(() => this.getParent()),
      },
    ];
  }

  override configureSession(session: Session): Session {
    return (
      session
        .onCompaction(
          createCompactFunction({
            // Side inference (outside the turn) resolves through `resolveModel()`
            // per Think 0.12 — it returns our explicit LanguageModel as-is, and
            // stays correct if `getModel()` ever returns a model-id string.
            summarize: (prompt) =>
              generateText({ model: this.resolveModel(), prompt }).then(
                (r) => r.text
              ),
          })
        )
        .onCompactionError((error) => {
          const orgId = this.parentPath.at(-1)?.name ?? "?";
          structuredLog({
            kind: "org_chat_auto_compaction_failed",
            severity: "error",
            organizationId: orgId,
            chatName: this.name,
            error: errorMessage(error),
          });
        })
        // Between-turns trigger: agents runs `compactAfter` after every
        // `appendMessage()` — once the stamped token estimate crosses this
        // budget, history compacts before the next turn assembles, giving
        // headroom below the model ceiling. The budget is per-model — the
        // chat model is fixed per instance, so this one-time set is correct.
        // Mid-turn growth is `contextOverflow`'s job (see onStart): the
        // proactive guard compacts on real step usage and the reactive
        // backstop compacts + retries an overflow-rejected turn.
        .compactAfter(getCompactionLimit(this.resolved.contextWindow))
    );
  }

  override onChatError(error: unknown): unknown {
    const orgId = this.parentPath.at(-1)?.name ?? "?";
    structuredLog({
      kind: "org_chat_turn_failed",
      severity: "error",
      organizationId: orgId,
      chatName: this.name,
      error: errorMessage(error),
    });
    return super.onChatError(error);
  }

  // Pairs with `contextOverflow.reactive` above: without it Think warns and
  // never treats any error as an overflow.
  override classifyChatError = defaultContextOverflowClassifier;

  /**
   * Client-callable manual compaction (the header menu). Everything else
   * compaction-related is Think built-in: `compactAfter` (pre-turn estimate),
   * and `contextOverflow` reactive + proactive (real-usage, mid-turn) with
   * this session's `onCompaction` function.
   */
  @callable()
  async compactNow(): Promise<{ compacted: boolean }> {
    const result = await this.session.compact();
    // The session's `compact` change event re-syncs Think's transcript cache.
    return { compacted: Boolean(result) };
  }

  /**
   * Parent-callable — `OrgAgent.searchChats` fans a query out to each
   * registered chat through this method. Deliberately NOT `@callable()`: it
   * is a parent-side side effect, not something a browser should trigger
   * directly (upstream directory pattern).
   *
   * Uses this chat's own Sessions FTS5 index (built lazily on first search,
   * text parts only) and trims each hit to a windowed snippet.
   */
  async searchMessages(
    query: string,
    limit = SEARCH_MAX_HITS_PER_CHAT
  ): Promise<ChatMessageHit[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }
    const results = await this.session.search(trimmed, { limit });
    return results.map((result) => ({
      messageId: result.id,
      role: result.role,
      snippet: snippetAround(result.content, trimmed),
    }));
  }

  override beforeTurn(_ctx: TurnContext) {
    // Reject unsupported attachment parts on the inbound user turn before the
    // provider call so text-only models (e.g. zai-coding-plan) never surface an
    // opaque content-type error. Only the latest user message is gated — older
    // history is left alone so a prior failed attach cannot block later text.
    const latestUser = [...this.messages]
      .reverse()
      .find((message) => message.role === "user");
    if (latestUser) {
      const attachmentParts = latestUser.parts.map((part) => ({
        type: part.type,
        mediaType:
          "mediaType" in part && typeof part.mediaType === "string"
            ? part.mediaType
            : undefined,
      }));
      const gate = gateChatAttachments(
        attachmentParts,
        this.resolved.capabilities
      );
      if (!gate.ok) {
        throw new Error(gate.reason);
      }
    }

    const organizationId = this.requireOrganizationId();
    this.ctx.waitUntil(
      this.getParent()
        .then((parent) => parent.touchChat(this.name))
        .catch((err: unknown) => {
          structuredLog({
            kind: "org_chat_touch_failed",
            severity: "error",
            organizationId,
            chatName: this.name,
            error: errorMessage(err),
          });
        })
    );

    // Retention for retained agent-tool runs (agents agent-tools.md › Clear
    // retained runs): delegate child facets and their run rows are kept for
    // refresh/drill-in by default and otherwise accumulate forever. Sweeping
    // off this chat's own activity piggybacks on the one wake that already
    // happens per turn — no alarms, and a stale run can't be mid-drill-in
    // when its chat hasn't been active for a week.
    this.ctx.waitUntil(
      this.clearAgentToolRuns({
        olderThan: Date.now() - AGENT_TOOL_RUN_RETENTION_MS,
      }).catch((err: unknown) => {
        structuredLog({
          kind: "org_agent_tool_run_cleanup_failed",
          severity: "error",
          organizationId,
          chatName: this.name,
          error: errorMessage(err),
        });
      })
    );

    // No instructions/model overrides: the system prompt is the context
    // blocks (org header + org_memory) and the model is `getModel()`.
  }

  /**
   * Agent-tool runs (the `delegate` children) are sub-agents of this chat.
   * Without this gate a guessed `/agents/org-agent/<org>/<chat>/sub/
   * org-sub-agent/<id>` URL spawns a fresh facet; the run registry is the
   * authority — only ids this chat actually launched resolve (agents
   * agent-tools.md › Drill in and gate access). Existence-check only: this
   * hook never creates.
   */
  override onBeforeSubAgent(
    _request: Request,
    child: { className: string; name: string }
  ): Promise<Response | undefined> {
    if (!this.hasAgentToolRun(child.className, child.name)) {
      return Promise.resolve(
        new Response(`Agent-tool run "${child.name}" not found`, {
          status: 404,
        })
      );
    }
    return Promise.resolve(undefined);
  }

  /** The ALS connection's stamped user, or undefined when unresolvable. */
  private tryResolveTurnUserId(): string | undefined {
    const { connection } = getCurrentAgent();
    return resolveTurnUserId(connection);
  }

  /**
   * Approvals run as the user who approved: rebuilding the tools here — under
   * the callable's own ALS connection (the socket that sent the approval
   * frame) — rebinds `this.codemode` to a runtime whose tool closures carry
   * the approver's identity. Think's `approveExecution` takes
   * `_codemodeRuntime()` (= `this.codemode`, assigned by `createExecuteTool`
   * inside `getTools()`) synchronously before the replay, so the paused
   * sandbox writes — which have no ALS connection at execute time — authorize
   * against the approver, and a concurrent turn's `getTools()` cannot swap
   * the runtime mid-replay. `@callable()` keeps the Think built-in
   * registered after the override (nearest decorated declaration wins).
   */
  @callable()
  override approveExecution(executionId: string): Promise<unknown> {
    try {
      this.getTools();
    } catch {
      // Fail closed: a leftover runtime is bound to whoever built the tools
      // last. Clearing it makes Think's approveExecution return its "no
      // codemode runtime" status error — its `_codemodeRuntime()` retries
      // `getTools()` once and, when that throws too, leaves the runtime
      // unset — so the approval settles without ever replaying under a
      // stale identity.
      this.codemode = undefined;
    }
    return super.approveExecution(executionId);
  }

  override getTools(): ToolSet {
    const self = this;
    // Identity is captured per invocation: getTools runs at turn start inside
    // the turn's ALS (think.js builds tools before beforeTurn), so the bound
    // user is the connection that started this turn / sent this approval.
    // Sandbox tool callbacks have no ALS of their own, so they read the bound
    // user; a live ALS connection at execute time (direct tool calls, the
    // approval continuation) still wins; neither → fail closed
    // (PERMISSION_DENIED_MESSAGE). No shared mutable field: any member's
    // approve/reject callable runs outside the turn queue and could
    // otherwise re-stamp another turn's identity mid-flight.
    const boundUserId = self.tryResolveTurnUserId();
    const toolsCtx = {
      get userId() {
        return (
          self.tryResolveTurnUserId() ??
          boundUserId ??
          (() => {
            throw new Error(PERMISSION_DENIED_MESSAGE);
          })()
        );
      },
      organizationId: this.organizationId,
      waitUntil: (promise: Promise<unknown>) => this.ctx.waitUntil(promise),
    };
    const productTools = getOrgAgentTools(toolsCtx);
    const displayTools = getOrgAgentDisplayTools(toolsCtx);

    // The read-only fetch tool is opt-in via FETCH_ALLOWED_HOSTS
    // (comma-separated hostnames). Empty/unset means no fetch tool at all.
    const fetchTools = fetchToolsForEnv(this.env.FETCH_ALLOWED_HOSTS);

    // Code execution (codemode). The one-liner infers state.*
    // from this.workspace and the executor from env.LOADER; the sandbox sees
    // ONLY the org's own product tools — `update_product` / `delete_product`
    // keep needsApproval, which inside the sandbox maps to the codemode
    // runtime's durable pause/approve/resume (resolved client-side via Think's
    // `approveExecution` / `rejectExecution` callables). No browser (no
    // BROWSER binding) and no delegate/display tools reach the sandbox. The
    // execute tool itself is NOT gated: read-only code runs freely in
    // the no-network sandbox; approvals come from the gated tools the code
    // calls.
    const executeTool = createExecuteTool(this, { tools: productTools });

    return {
      ...fetchTools,
      ...productTools,
      // Child dynamic agent with its own context window — see `OrgSubAgent`.
      delegate: agentTool(OrgSubAgent, {
        description:
          "Delegate ONE self-contained research or analysis task to a focused sub-agent that works in its own context window with read-only access to the org's products. Use this for multi-step data gathering or analysis that would otherwise clutter this conversation. The sub-agent cannot see this conversation and cannot modify any data — give it a complete, standalone task description. Returns the sub-agent's result summary.",
        inputSchema: z.object({
          task: z
            .string()
            .min(10)
            .describe(
              "A complete, standalone description of the task, including every detail the sub-agent needs. It does not see this conversation."
            ),
        }),
        displayName: "Sub-agent",
      }),
      ...displayTools,
      execute: executeTool,
    };
  }
}
