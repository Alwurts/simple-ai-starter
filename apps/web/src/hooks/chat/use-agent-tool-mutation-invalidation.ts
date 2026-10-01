"use client";

import type { ToolLogEntry } from "@cloudflare/codemode";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { AGENT_WRITE_TOOL_NAMES } from "@workspace/agent/constants";
import { getToolName, isToolUIPart } from "ai";
import { useEffect, useRef } from "react";
import { getProductsKey } from "@/hooks/catalog/use-products";
import type { OrgChatMessage } from "@/lib/chat/ai-types";

const WRITE_TOOLS: ReadonlySet<string> = new Set(AGENT_WRITE_TOOL_NAMES);

function isWriteTool(method: string | undefined): boolean {
  return Boolean(method && WRITE_TOOLS.has(method));
}

function isSuccessfulToolOutput(output: unknown): boolean {
  if (!output || typeof output !== "object") {
    return true;
  }
  if ("ok" in output && (output as { ok: unknown }).ok === false) {
    return false;
  }
  return true;
}

/**
 * Writes applied by sandboxed `execute` code, read from the run's settled
 * output (`calls` tool log). Only `applied` entries ran — `pending` and
 * `executing` did not, `reverted` was undone, `error` failed.
 */
function executeAppliedWrite(settledOutput: unknown): boolean {
  if (!settledOutput || typeof settledOutput !== "object") {
    return false;
  }
  const status = (settledOutput as { status?: unknown }).status;
  if (status !== "completed" && status !== "error") {
    return false;
  }
  const calls = (settledOutput as { calls?: ToolLogEntry[] }).calls;
  if (!Array.isArray(calls)) {
    return false;
  }
  return calls.some(
    (call) => call?.state === "applied" && isWriteTool(call.method)
  );
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
    return isSuccessfulToolOutput(part.output) &&
      !alreadyHandled.has(toolCallId)
      ? toolCallId
      : null;
  }
  if (method === "execute") {
    const eventId = `${toolCallId}:calls`;
    return executeAppliedWrite(part.output) && !alreadyHandled.has(eventId)
      ? eventId
      : null;
  }
  return null;
}

/**
 * Ids of write completions not yet handled: a settled top-level write tool
 * (its toolCallId) or a settled codemode run that applied a sandboxed write
 * (`<toolCallId>:calls`). Pure helper — exported for unit tests.
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
 * Mark the completion ids handled and invalidate the products queries once
 * if any were new. Exported for unit tests.
 */
export function applyWriteToolInvalidations(options: {
  ids: string[];
  handled?: Set<string>;
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
  // all products queries — list and detail alike.
  if (invalidated) {
    options.queryClient.invalidateQueries({ queryKey: getProductsKey() });
  }
}

/**
 * Invalidate React Query when agent writes settle: top-level write tools
 * (`create_product`, …) and writes applied inside codemode runs (settled
 * `execute` output `calls`). Custom because no built-in ties transcript tool
 * parts to the query cache; "write tool" comes from
 * `AGENT_WRITE_TOOL_NAMES` (packages/agent), not a web-side list.
 */
export function useAgentToolMutationInvalidation(options: {
  messages: OrgChatMessage[];
}) {
  const { messages } = options;
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
      queryClient,
    });
  }, [messages, queryClient]);
}
