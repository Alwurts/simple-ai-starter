import bundledSkills from "agents:skills";
import type { WorkspaceFsLike } from "@cloudflare/shell";
import {
  defaultContextOverflowClassifier,
  type Session,
  type SkillSource,
  type StepContext,
  Think,
  type TurnContext,
} from "@cloudflare/think";
import { createExecuteTool } from "@cloudflare/think/tools/execute";
import { createFetchTools } from "@cloudflare/think/tools/fetch";
import { auth } from "@workspace/auth";
import { errorMessage, structuredLog } from "@workspace/log";
import {
  type Connection,
  type ConnectionContext,
  callable,
  getCurrentAgent,
} from "agents";
import { agentTool } from "agents/agent-tools";
import type { ChatResponseResult } from "agents/chat";
import type { ContextConfig } from "agents/context";
import { createCompactFunction } from "agents/sessions";
import {
  generateText,
  type LanguageModel,
  type LanguageModelUsage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { buildOrgContext } from "../../context/assemble";
import {
  getOrgAgentDisplayTools,
  getOrgAgentTools,
} from "../../in-app/compose-org-tools";
import {
  gateChatAttachments,
  getCompactionLimit,
  type OrgChatModelCapabilities,
  orgChatContextOverflow,
  resolveOrgChatModel,
} from "../../inference/chat-models";
import type { ChatMessageHit } from "../../types";
import { resolveTurnUserId } from "../bootstrap";
import { OrgAgent } from "../org-agent";
import {
  fetchAllowlistForHosts,
  parseFetchAllowedHosts,
} from "./fetch-allowlist";
import { OrgMemoryProvider } from "./org-memory-provider";
import { OrgSubAgent } from "./org-sub-agent";
import { SEARCH_MAX_HITS_PER_CHAT, snippetAround } from "./search";
import { SharedWorkspace } from "./shared-workspace";

type OrgAgentParent = Pick<
  OrgAgent,
  "readOrgMemory" | "writeOrgMemory" | "touchChat"
>;

export class OrgChat extends Think<Cloudflare.Env> {
  override maxSteps = 50;

  override workspace: WorkspaceFsLike = new SharedWorkspace(this);

  private organizationId!: string;
  private resolvedChatModel!: LanguageModel;
  private resolvedModelId!: string;
  private resolvedContextWindow!: number;
  private resolvedCapabilities!: OrgChatModelCapabilities;
  private lastTurnUsage: LanguageModelUsage | undefined;
  /** Acting user for tool execute / approve-resume (WebSocket ALS is often unset). */
  private turnUserId: string | undefined;

  override onStart(): void {
    this.organizationId = this.requireOrganizationId();
    // The chat model is a constant env-driven resolution — resolve it once here
    // rather than re-resolving every turn.
    const resolved = resolveOrgChatModel(this.env);
    this.resolvedChatModel = resolved.model;
    this.resolvedModelId = resolved.modelId;
    this.resolvedContextWindow = resolved.contextWindow;
    this.resolvedCapabilities = resolved.capabilities;
    // Context-window overflow recovery (Think built-in, D-016) — the reactive
    // backstop compacts and retries a turn a provider rejected as too long,
    // and the proactive guard compacts mid-turn once real step usage crosses
    // 90% of the model's window. `compactAfter` (below) keeps the cheaper
    // pre-turn estimate heuristic as the first line of defence.
    this.contextOverflow = orgChatContextOverflow(this.resolvedContextWindow);
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
   * Capture the acting user id for tool execute / approve-resume. The
   * security boundary is the Worker gate in `apps/web/src/server.ts` (session
   * + active-org check before any `/agents/` route) — Think may stream the
   * transcript before this runs, so onConnect is identification, not a gate.
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
    // In-memory copy for tool closures: getTools often lacks WebSocket ALS.
    this.turnUserId = userId;
  }

  override getModel(): LanguageModel {
    return this.resolvedChatModel;
  }

  /**
   * The bundled example skills (D-010). `agents:skills` is resolved by the
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
        // Primary trigger: Think's heuristic auto-compacts *before* a turn is
        // assembled once its token estimate crosses this budget, giving real
        // headroom below the model ceiling (unlike pinning it to the full window).
        // The budget is per-model — the chat model is fixed per instance, so this
        // one-time set is correct. `maybeCompactByUsage` layers a stricter
        // real-usage trigger on top for tool-heavy histories the estimate
        // under-counts.
        .compactAfter(getCompactionLimit(this.resolvedContextWindow))
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

  override onStepFinish(ctx: StepContext): void {
    super.onStepFinish(ctx);
    if (ctx.usage) {
      this.lastTurnUsage = ctx.usage;
    }
  }

  override async onChatResponse(result: ChatResponseResult): Promise<void> {
    await super.onChatResponse(result);

    const usage = this.lastTurnUsage;
    const modelId = this.resolvedModelId;
    this.lastTurnUsage = undefined;

    if (result.status !== "completed" || !usage?.inputTokens || !modelId) {
      return;
    }

    // Stamp model/usage metadata on the finished assistant message. The
    // session's `update` change event patches Think's transcript cache, so no
    // explicit re-sync is needed.
    const safe = await this.updateMessageInHistory({
      ...result.message,
      metadata: {
        ...(result.message.metadata ?? {}),
        createdAt: new Date().toISOString(),
        status: "success",
        modelId,
        usage,
      },
    });

    if (safe) {
      this.broadcast(
        JSON.stringify({
          type: "cf_agent_message_updated",
          message: safe,
        })
      );
    }
  }

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
      createdAt: result.createdAt ?? null,
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
        this.resolvedCapabilities
      );
      if (!gate.ok) {
        throw new Error(gate.reason);
      }
    }

    // Refresh after hibernation (onConnect does not re-run).
    try {
      this.turnUserId = this.requireConnectedUserId();
    } catch {
      // Keep onConnect value when ALS is unset (approve/resume paths).
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

    // No instructions/model overrides: the system prompt is the context
    // blocks (org header + org_memory) and the model is `getModel()`.
  }

  private requireConnectedUserId(): string {
    const { connection } = getCurrentAgent();
    const orgId = this.parentPath.at(-1)?.name ?? "?";
    return resolveTurnUserId(connection, `${orgId}/${this.name}`);
  }

  /**
   * Acting user for tool execute / approve-resume: turnUserId, then ALS
   * connection, then any live connection attachment (resume often has no ALS).
   */
  private requireTurnUserId(): string {
    if (this.turnUserId) {
      return this.turnUserId;
    }
    try {
      const userId = this.requireConnectedUserId();
      this.turnUserId = userId;
      return userId;
    } catch {
      // fall through to connection scan
    }
    for (const connection of this.getConnections<{ userId?: string }>()) {
      const userId = connection.state?.userId;
      if (userId) {
        this.turnUserId = userId;
        return userId;
      }
    }
    const orgId = this.parentPath.at(-1)?.name ?? "?";
    throw new Error(
      `OrgAgent ${orgId}/${this.name}: no active connection for this turn`
    );
  }

  override getTools(): ToolSet {
    const self = this;
    // Lazy: getTools runs before beforeTurn; tool execute often has no ALS.
    const toolsCtx = {
      get userId() {
        return self.requireTurnUserId();
      },
      organizationId: this.organizationId,
      waitUntil: (promise: Promise<unknown>) => this.ctx.waitUntil(promise),
    };
    const productTools = getOrgAgentTools(toolsCtx);
    const displayTools = getOrgAgentDisplayTools(toolsCtx);

    // D-010: the read-only fetch tool is opt-in via FETCH_ALLOWED_HOSTS
    // (comma-separated hostnames). Empty/unset means no fetch tool at all —
    // `createFetchTools` is only called when the allowlist parses non-empty.
    const fetchHosts = parseFetchAllowedHosts(this.env.FETCH_ALLOWED_HOSTS);
    const fetchTools =
      fetchHosts.length > 0
        ? createFetchTools({ allowlist: fetchAllowlistForHosts(fetchHosts) })
        : {};

    // D-010 / D-015: code execution (codemode). The one-liner infers state.*
    // from this.workspace and the executor from env.LOADER; the sandbox sees
    // ONLY the org's own product tools — `update_product` / `delete_product`
    // keep needsApproval, which inside the sandbox maps to the codemode
    // runtime's durable pause/approve/resume (resolved client-side via Think's
    // `approveExecution` / `rejectExecution` callables). No browser (no
    // BROWSER binding) and no delegate/display tools reach the sandbox. The
    // execute tool itself is NOT gated (D-015): read-only code runs freely in
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
