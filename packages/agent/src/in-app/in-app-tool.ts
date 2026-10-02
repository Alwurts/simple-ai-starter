import { type ToolSet, tool } from "ai";
import type { z } from "zod";
import type { ToolContext } from "../tool-parts/context";

/**
 * One tool definition, bound per consumer (in-app chat, read-only delegate,
 * codemode via the chat tool set, an MCP binder later). `needsApproval` lives
 * on the part. `execute` returns the value or throws; the AI SDK turns a
 * throw into the tool-error result (`output-error` / `errorText`).
 */
export interface ToolPart<Schema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  inputSchema: Schema;
  needsApproval?: boolean;
  execute: (ctx: ToolContext, input: z.infer<Schema>) => Promise<unknown>;
}

export function inAppTool(toolCtx: ToolContext) {
  return function bindInAppTool<Schema extends z.ZodType>(
    part: ToolPart<Schema>
  ) {
    return tool({
      description: part.description,
      inputSchema: part.inputSchema,
      needsApproval: part.needsApproval,
      execute: (input: z.infer<Schema>) => part.execute(toolCtx, input),
    });
  };
}

/** Bind an explicit part list. Each surface picks its own list. */
export function bindAll(ctx: ToolContext, parts: readonly ToolPart[]): ToolSet {
  const bind = inAppTool(ctx);
  return Object.fromEntries(parts.map((part) => [part.name, bind(part)]));
}
