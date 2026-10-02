import { type Session, Think } from "@cloudflare/think";
import { errorMessage, structuredLog } from "@workspace/log";
import type { ContextConfig } from "agents/context";
import { createCompactFunction } from "agents/sessions";
import { generateText, type ToolSet } from "ai";
import { buildOrgContext } from "../../context/assemble";
import { getOrgAgentReadOnlyTools } from "../../in-app/compose-org-tools";
import {
  getCompactionLimit,
  type ResolvedOrgChatModel,
  resolveOrgChatModel,
} from "../../inference/chat-models";

const SUB_AGENT_INSTRUCTIONS = `You are a focused sub-agent invoked by the main organization assistant to complete ONE self-contained task, handed to you as the first message.

You do not see the parent conversation — work only from the task you are given. You have READ-ONLY access to the organization's products through top-level tools (\`list_products\`, \`get_product\`). You CANNOT modify any data.

Do the task thoroughly, then return a concise, self-contained result the parent assistant can relay to the user. Prefer a direct answer over narrating your steps.`;

/**
 * A general-purpose delegation sub-agent. The main `OrgChat` exposes
 * it as the `delegate` tool via `agentTool(OrgSubAgent, …)`; the model calls it
 * to run a self-contained research/analysis task in its OWN context window
 * (keeping heavy work out of the main chat's tokens) with read-only org reach.
 *
 * Topology: it is a dynamic agent (facet) under `OrgChat` under `OrgAgent`
 * (`OrgAgent → OrgChat → OrgSubAgent`), so it needs no wrangler binding or
 * migration — just a named export from the worker entry — and the existing
 * `/agents/org-agent/` gate org-scopes the whole subtree. Its `organizationId`
 * comes from the trusted parent path (the root `OrgAgent` entry), never from
 * model input.
 */
export class OrgSubAgent extends Think<Cloudflare.Env> {
  override maxSteps = 30;

  private resolvedModel: ResolvedOrgChatModel | undefined;

  /**
   * Env-driven model resolution, memoised. Lazy — not an onStart field — for
   * the same startup-order reason as OrgChat: Think runs `configureSession`
   * ahead of the subclass `onStart`, so `compactAfter` reads it first.
   */
  private get resolved(): ResolvedOrgChatModel {
    this.resolvedModel ??= resolveOrgChatModel(this.env);
    return this.resolvedModel;
  }

  // `parentPath` is root-first: [{ OrgAgent, org }, { OrgChat, chatId }]. The
  // organization is the OrgAgent ancestor at the root — the trusted source of
  // scope for this dynamic agent (the model cannot forge it). A getter, not an
  // onStart field: `configureContext` runs before onStart, and the org header
  // block reads it during startup.
  private get organizationId(): string {
    return this.resolveOrganizationId();
  }

  private resolveOrganizationId(): string {
    const organizationId = this.parentPath[0]?.name;
    if (!organizationId) {
      throw new Error(
        `OrgSubAgent ${this.name}: missing OrgAgent ancestor in parent path`
      );
    }
    return organizationId;
  }

  override getModel() {
    return this.resolved.model;
  }

  override configureSession(session: Session): Session {
    return session
      .onCompaction(
        createCompactFunction({
          summarize: (prompt) =>
            generateText({ model: this.resolveModel(), prompt }).then(
              (r) => r.text
            ),
        })
      )
      .onCompactionError((error) => {
        structuredLog({
          kind: "org_sub_agent_auto_compaction_failed",
          severity: "error",
          organizationId: this.resolveOrganizationId(),
          chatName: this.name,
          error: errorMessage(error),
        });
      })
      .compactAfter(getCompactionLimit(this.resolved.contextWindow));
  }

  override getTools(): ToolSet {
    // Read-only reach only (list/get products). The sub-agent
    // has no acting user and can never mutate. Org scope is the trusted
    // `this.organizationId`.
    return getOrgAgentReadOnlyTools({
      organizationId: this.organizationId,
    });
  }

  /**
   * Prompt blocks, same pattern as OrgChat: static instructions and the
   * per-org header are read-only context blocks (frozen, persisted prompt),
   * replacing the old per-turn `beforeTurn` instructions/model override.
   */
  override configureContext(): ContextConfig[] {
    return [
      {
        label: "instructions",
        provider: { get: async () => SUB_AGENT_INSTRUCTIONS },
      },
      {
        label: "org",
        provider: {
          get: async () => {
            const { header } = await buildOrgContext(this.organizationId);
            return header;
          },
        },
      },
    ];
  }
}
