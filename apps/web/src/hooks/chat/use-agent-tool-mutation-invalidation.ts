"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { AGENT_WRITE_TOOL_NAMES } from "@workspace/agent/constants";
import { getToolName, isToolUIPart } from "ai";
import { useEffect, useRef } from "react";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { productsQueryKey } from "@/lib/catalog/product-queries";
import type { OrgChatMessage } from "@/lib/chat/ai-types";

const WRITE_TOOLS: ReadonlySet<string> = new Set(AGENT_WRITE_TOOL_NAMES);

function isWriteTool(method: string | undefined): boolean {
  return Boolean(method && WRITE_TOOLS.has(method));
}

/** Completion id for one assistant part, or null when it isn't a new write. */
function writeCompletionIdForPart(
  part: OrgChatMessage["parts"][number],
  alreadyHandled: ReadonlySet<string>
): string | null {
  if (
    !isToolUIPart(part) ||
    typeof part.toolCallId !== "string" ||
    part.toolCallId.length === 0
  ) {
    return null;
  }
  if (part.state !== "output-available") {
    // Approval-gated writes pause with `approval-requested` until the
    // user responds — a part is only read once it settles.
    return null;
  }
  const toolCallId = part.toolCallId;
  const method = getToolName(part);
  if (isWriteTool(method)) {
    // A failed write is `output-error`, not `output-available`, so a settled
    // write part is a real mutation. The old `{ ok: false }` envelope is gone.
    return alreadyHandled.has(toolCallId) ? null : toolCallId;
  }
  return null;
}

/**
 * Ids of write completions not yet handled. A settled top-level write tool
 * contributes its toolCallId. Pure helper, exported for unit tests.
 */
export function collectWriteToolCompletionIds(
  messages: OrgChatMessage[],
  alreadyHandled: ReadonlySet<string>
): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      const id = writeCompletionIdForPart(part, alreadyHandled);
      if (id) {
        ids.push(id);
      }
    }
  }
  return ids;
}

/**
 * Mark the completion ids handled and invalidate the org's products queries
 * once if any were new. Exported for unit tests.
 */
export function applyWriteToolInvalidations(options: {
  ids: string[];
  handled?: Set<string>;
  organizationId: string;
  queryClient: QueryClient;
}): void {
  const handled = options.handled ?? new Set<string>();
  let invalidated = false;
  for (const id of options.ids) {
    if (handled.has(id)) {
      continue;
    }
    handled.add(id);
    invalidated = true;
  }
  // Every write tool mutates the catalog, so one prefix invalidation covers
  // all products queries — list, detail and search alike.
  if (invalidated) {
    options.queryClient.invalidateQueries({
      queryKey: productsQueryKey(options.organizationId),
    });
  }
}

/**
 * Invalidate React Query when a top-level write tool settles
 * (`create_product`, …). Custom because no built-in ties transcript tool
 * parts to the query cache. "Write tool" comes from
 * `AGENT_WRITE_TOOL_NAMES` (packages/agent), not a web-side list.
 */
export function useAgentToolMutationInvalidation(options: {
  messages: OrgChatMessage[];
}) {
  const { messages } = options;
  const { organizationId } = useOrgConnection();
  const queryClient = useQueryClient();
  const handledRef = useRef(new Set<string>());

  // biome-ignore lint/plugin/no-use-effect: invalidate react-query when write tool parts complete
  useEffect(() => {
    const ids = collectWriteToolCompletionIds(messages, handledRef.current);
    if (ids.length === 0) {
      return;
    }
    applyWriteToolInvalidations({
      ids,
      handled: handledRef.current,
      organizationId,
      queryClient,
    });
  }, [messages, organizationId, queryClient]);
}
