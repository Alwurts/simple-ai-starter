/** Keep in sync with `in-app/display.ts`. The chat UI matches these names. */
export const DISPLAY_TOOL_NAMES = {
  PRODUCT_LIST: "display_product_list",
  MEMORY: "display_memory",
} as const;

export type DisplayToolName =
  (typeof DISPLAY_TOOL_NAMES)[keyof typeof DISPLAY_TOOL_NAMES];

/**
 * Mutating top-level org-agent tools. The web chat invalidates its products
 * queries when one of these settles (or when a codemode run applied one).
 */
export const AGENT_WRITE_TOOL_NAMES = [
  "create_product",
  "update_product",
  "delete_product",
] as const;

export type AgentWriteToolName = (typeof AGENT_WRITE_TOOL_NAMES)[number];

/**
 * Thrown by the RBAC guard (`tools/guard.ts`) when the caller's role isn't
 * allowed to run a write tool. It crosses the wire as the tool part's
 * `errorText`, so the chat UI matches on this exact string to render a calm
 * "not permitted" affordance instead of a generic red error.
 */
export const PERMISSION_DENIED_MESSAGE =
  "You don't have permission to perform this action.";
