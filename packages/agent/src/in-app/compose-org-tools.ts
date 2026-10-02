import type { ToolSet } from "ai";
import {
  productReadToolParts,
  productToolParts,
} from "../tool-parts/catalog/products";
import { readOnlyToolContext } from "../tool-parts/context";
import type { AgentToolsContext } from "../types";
import { bindAll } from "./in-app-tool";

/** Top-level product tools for OrgChat. Authoring guide: `docs/guides/writing-agent-tools.md`. */
export const getOrgAgentTools = (ctx: AgentToolsContext): ToolSet =>
  bindAll(ctx, productToolParts);

/** Read-only reach for delegated sub-agents (`OrgSubAgent`). */
export const getOrgAgentReadOnlyTools = (
  ctx: Pick<AgentToolsContext, "organizationId">
): ToolSet =>
  bindAll(readOnlyToolContext(ctx.organizationId), productReadToolParts);
