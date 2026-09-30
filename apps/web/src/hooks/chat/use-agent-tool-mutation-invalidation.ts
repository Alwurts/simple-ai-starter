"use client";

import type { ToolLogEntry } from "@cloudflare/codemode";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { getToolName, isToolUIPart } from "ai";
import { useEffect, useRef } from "react";
import {
  AGENT_TOOL_INVALIDATION_REGISTRY,
  type AgentAppliedWrite,
  invalidateForAgentWrite,
} from "@/lib/chat/agent-tool-invalidation-registry";
import type { OrgChatMessage } from "@/lib/chat/ai-types";

function isRegisteredWrite(method: string | undefined): method is string {
  return Boolean(method && method in AGENT_TOOL_INVALIDATION_REGISTRY);
}

function isWriteToolPart(part: OrgChatMessage["parts"][number]): boolean {
  // `ai`'s guard covers dynamic-tool parts too — no separate type check.
  if (!isToolUIPart(part)) {
    return false;
  }
  if (!isRegisteredWrite(getToolName(part))) {
    return false;
  }
  return typeof part.toolCallId === "string" && part.toolCallId.length > 0;
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
 * output (`calls` tool log). Only `applied` entries count — `pending` and
 * `executing` never ran, `reverted` was undone, `error` failed.
 */
function executeAppliedWrites(
  toolCallId: string,
  output: unknown
): { eventId: string; writes: AgentAppliedWrite[] } | null {
  if (!output || typeof output !== "object") {
    return null;
  }
  const status = (output as { status?: unknown }).status;
  if (status !== "completed" && status !== "error") {
    return null;
  }
  const calls = (output as { calls?: ToolLogEntry[] }).calls;
  if (!Array.isArray(calls)) {
    return null;
  }
  const writes: AgentAppliedWrite[] = [];
  for (const call of calls) {
    if (call?.state !== "applied") {
      continue;
    }
    if (isRegisteredWrite(call.method)) {
      writes.push({ method: call.method, args: call.args });
    }
  }
  if (writes.length === 0) {
    return null;
  }
  return { eventId: `${toolCallId}:calls`, writes };
}

export interface WriteToolCompletionEvent {
  eventId: string;
  writes: AgentAppliedWrite[];
}

/**
 * Scan one assistant message part for a completed write: a top-level write
 * tool or a settled codemode run that applied sandboxed writes.
 */
function writeEventForPart(
  part: OrgChatMessage["parts"][number],
  alreadyHandled: ReadonlySet<string>
): WriteToolCompletionEvent | null {
  if (!isToolUIPart(part)) {
    return null;
  }
  const toolCallId = part.toolCallId;
  if (typeof toolCallId !== "string" || toolCallId.length === 0) {
    return null;
  }
  if (part.state !== "output-available") {
    return null;
  }

  if (isWriteToolPart(part)) {
    if (alreadyHandled.has(toolCallId)) {
      return null;
    }
    if (!isSuccessfulToolOutput(part.output)) {
      return null;
    }
    return {
      eventId: toolCallId,
      writes: [{ method: getToolName(part), args: part.input }],
    };
  }

  // Codemode: the run's recorded tool calls applied inside the sandbox.
  if (getToolName(part) === "execute") {
    const applied = executeAppliedWrites(toolCallId, part.output);
    if (applied && !alreadyHandled.has(applied.eventId)) {
      return { eventId: applied.eventId, writes: applied.writes };
    }
  }
  return null;
}

/**
 * Scan assistant message tool parts for successful top-level write tools and
 * for writes applied inside settled codemode runs (`execute` output `calls`).
 * Pure helper — exported for unit tests.
 */
export function collectWriteToolCompletionEvents(
  messages: OrgChatMessage[],
  alreadyHandled: ReadonlySet<string>
): WriteToolCompletionEvent[] {
  const events: WriteToolCompletionEvent[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }
    for (const part of message.parts) {
      const event = writeEventForPart(part, alreadyHandled);
      if (event) {
        events.push(event);
      }
    }
  }

  return events;
}

/**
 * Invalidate React Query for completed write-tool events. Exported for unit tests.
 */
export function applyWriteToolCompletionInvalidations(options: {
  events: WriteToolCompletionEvent[];
  handled?: Set<string>;
  queryClient: QueryClient;
}): void {
  const handled = options.handled ?? new Set<string>();
  for (const event of options.events) {
    if (handled.has(event.eventId)) {
      continue;
    }
    handled.add(event.eventId);
    for (const write of event.writes) {
      invalidateForAgentWrite(options.queryClient, write);
    }
  }
}

/**
 * Watch `messages` for completed agent writes and invalidate matching React
 * Query keys: top-level write tools (`create_product`, …) and writes applied
 * inside the codemode sandbox (settled `execute` output `calls`). Approval
 * gates pause with AI SDK `approval-requested` / the durable pause until the
 * user responds, so a part is only read once it settles.
 */
export function useAgentToolMutationInvalidation(options: {
  messages: OrgChatMessage[];
}) {
  const { messages } = options;
  const queryClient = useQueryClient();
  const handledRef = useRef(new Set<string>());

  // biome-ignore lint/plugin/no-use-effect: invalidate react-query when write tool parts complete
  useEffect(() => {
    const events = collectWriteToolCompletionEvents(
      messages,
      handledRef.current
    );
    if (events.length === 0) {
      return;
    }

    applyWriteToolCompletionInvalidations({
      events,
      handled: handledRef.current,
      queryClient,
    });
  }, [messages, queryClient]);
}
