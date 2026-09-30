import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  applyWriteToolInvalidations,
  collectWriteToolCompletionIds,
} from "@/hooks/chat/use-agent-tool-mutation-invalidation";
import type { OrgChatMessage } from "@/lib/chat/ai-types";

function assistantWithToolPart(
  toolName: string,
  options: {
    toolCallId?: string;
    state?: string;
    input?: unknown;
    output?: unknown;
  } = {}
): OrgChatMessage {
  const {
    toolCallId = "tc_1",
    state = "output-available",
    input = { id: "p1" },
    output = { ok: true, data: null },
  } = options;
  return {
    id: "m1",
    role: "assistant",
    parts: [
      {
        type: `tool-${toolName}`,
        toolCallId,
        state,
        input,
        output,
      },
    ],
  } as OrgChatMessage;
}

describe("collectWriteToolCompletionIds", () => {
  it("emits a completed write toolCallId once", () => {
    const messages = [
      assistantWithToolPart("update_product", {
        input: { id: "prod_1", data: { name: "Fresh" } },
      }),
    ];
    expect(collectWriteToolCompletionIds(messages, new Set())).toEqual([
      "tc_1",
    ]);
    expect(collectWriteToolCompletionIds(messages, new Set(["tc_1"]))).toEqual(
      []
    );
  });

  it("ignores approval-requested parts, read-only tools and delegate runs", () => {
    const messages: OrgChatMessage[] = [
      assistantWithToolPart("delete_product", {
        state: "approval-requested",
        input: { id: "p1" },
        output: undefined,
      }),
      assistantWithToolPart("delegate", {
        toolCallId: "tc_d",
        input: { task: "research" },
        output: { summary: "done" },
      }),
      assistantWithToolPart("list_products", {
        toolCallId: "tc_list",
        input: {},
        output: { ok: true, data: [] },
      }),
    ];
    expect(collectWriteToolCompletionIds(messages, new Set())).toEqual([]);
  });

  it("skips failed write outputs (ok:false)", () => {
    const messages = [
      assistantWithToolPart("delete_product", {
        input: { id: "missing" },
        output: { ok: false, error: "not found", code: "not_found" },
      }),
    ];
    expect(collectWriteToolCompletionIds(messages, new Set())).toEqual([]);
  });
});

describe("collectWriteToolCompletionIds — codemode execute calls", () => {
  function assistantWithExecute(output: unknown, toolCallId = "tc_exec") {
    return assistantWithToolPart("execute", {
      toolCallId,
      input: { code: "await tools.update_product(...)" },
      output,
    });
  }

  const appliedUpdate = {
    seq: 2,
    connector: "tools",
    method: "update_product",
    args: { id: "prod_9", data: { price: 949 } },
    requiresApproval: true,
    state: "applied",
  };

  it("emits applied sandbox writes from a settled execute output", () => {
    const messages = [
      assistantWithExecute({
        status: "completed",
        executionId: "ex_1",
        result: { done: true },
        calls: [
          { ...appliedUpdate, seq: 1, method: "list_products" },
          appliedUpdate,
        ],
      }),
    ];
    expect(collectWriteToolCompletionIds(messages, new Set())).toEqual([
      "tc_exec:calls",
    ]);
    expect(
      collectWriteToolCompletionIds(messages, new Set(["tc_exec:calls"]))
    ).toEqual([]);
  });

  it("ignores paused runs, non-applied entries and read-only-only runs", () => {
    const messages: OrgChatMessage[] = [
      assistantWithExecute({
        status: "paused",
        executionId: "ex_1",
        pending: [],
        calls: [appliedUpdate],
      }),
      assistantWithExecute(
        {
          status: "completed",
          executionId: "ex_2",
          calls: [
            { ...appliedUpdate, seq: 1, state: "pending" },
            {
              ...appliedUpdate,
              seq: 3,
              method: "list_products",
              requiresApproval: false,
            },
          ],
        },
        "tc_exec_2"
      ),
    ];
    expect(collectWriteToolCompletionIds(messages, new Set())).toEqual([]);
  });
});

describe("applyWriteToolInvalidations", () => {
  it("invalidates the products prefix once for new completion ids", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;
    const handled = new Set<string>();

    applyWriteToolInvalidations({
      ids: ["tc_create"],
      handled,
      queryClient,
    });
    applyWriteToolInvalidations({
      ids: ["tc_create"],
      handled,
      queryClient,
    });

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products"],
    });
  });

  it("does not invalidate when nothing is new", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    applyWriteToolInvalidations({
      ids: [],
      handled: new Set(),
      queryClient,
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});
