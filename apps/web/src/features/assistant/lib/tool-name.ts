import type { DynamicToolUIPart, ToolUIPart } from "ai";

/** Tool name from a tool part: `toolName` on dynamic parts, else `tool-` prefix. */
export function getToolName(part: ToolUIPart | DynamicToolUIPart): string {
  if ("toolName" in part && typeof part.toolName === "string") {
    return part.toolName;
  }
  if (part.type.startsWith("tool-")) {
    return part.type.slice(5);
  }
  return part.type;
}
