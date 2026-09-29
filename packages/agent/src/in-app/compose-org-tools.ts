import type { ToolSet } from "ai";
import {
  createProductDescription,
  createProductExecute,
  createProductInputSchema,
  createProductName,
  deleteProductDescription,
  deleteProductExecute,
  deleteProductInputSchema,
  deleteProductName,
  getProductDescription,
  getProductExecute,
  getProductInputSchema,
  getProductName,
  listProductsDescription,
  listProductsExecute,
  listProductsInputSchema,
  listProductsName,
  updateProductDescription,
  updateProductExecute,
  updateProductInputSchema,
  updateProductName,
} from "../tool-parts/catalog/products";
import { readOnlyToolContext } from "../tool-parts/context";
import type { AgentToolsContext } from "../types";
import { createDisplayTools } from "./display";
import { inAppTool } from "./in-app-tool";

function bindProductReadTools(bind: ReturnType<typeof inAppTool>): ToolSet {
  return {
    [listProductsName]: bind({
      name: listProductsName,
      description: listProductsDescription,
      inputSchema: listProductsInputSchema,
      execute: listProductsExecute,
    }),
    [getProductName]: bind({
      name: getProductName,
      description: getProductDescription,
      inputSchema: getProductInputSchema,
      execute: getProductExecute,
    }),
  };
}

/** Top-level product tools for OrgChat. Authoring guide: `docs/guides/writing-agent-tools.md`. */
export const getOrgAgentTools = (ctx: AgentToolsContext): ToolSet => {
  const bind = inAppTool(ctx);
  return {
    ...bindProductReadTools(bind),
    [createProductName]: bind({
      name: createProductName,
      description: createProductDescription,
      inputSchema: createProductInputSchema,
      execute: createProductExecute,
    }),
    [updateProductName]: bind({
      name: updateProductName,
      description: updateProductDescription,
      inputSchema: updateProductInputSchema,
      needsApproval: true,
      execute: updateProductExecute,
    }),
    [deleteProductName]: bind({
      name: deleteProductName,
      description: deleteProductDescription,
      inputSchema: deleteProductInputSchema,
      needsApproval: true,
      execute: deleteProductExecute,
    }),
  };
};

export const getOrgAgentDisplayTools = (ctx: AgentToolsContext): ToolSet =>
  createDisplayTools(ctx);

/** Read-only reach for delegated sub-agents (`OrgSubAgent`). */
export const getOrgAgentReadOnlyTools = (
  ctx: Pick<AgentToolsContext, "organizationId">
): ToolSet =>
  bindProductReadTools(inAppTool(readOnlyToolContext(ctx.organizationId)));
