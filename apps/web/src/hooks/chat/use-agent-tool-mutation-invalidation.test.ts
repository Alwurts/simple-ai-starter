import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  applyWriteToolCompletionInvalidations,
  collectWriteToolCompletionEvents,
} from "@/hooks/chat/use-agent-tool-mutation-invalidation";
import { invalidateForAgentWrite } from "@/lib/chat/agent-tool-invalidation-registry";
import type { OrgChatMessage } from "@/lib/chat/ai-types";

function assistantWithWriteTool(
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

describe("collectWriteToolCompletionEvents", () => {
  it("emits completed write toolCallIds once", () => {
    const messages = [
      assistantWithWriteTool("update_product", {
        input: { id: "prod_1", data: { name: "Fresh" } },
      }),
    ];
    const first = collectWriteToolCompletionEvents(messages, new Set());
    expect(first).toEqual([
      {
        eventId: "tc_1",
        writes: [
          {
            method: "update_product",
            args: { id: "prod_1", data: { name: "Fresh" } },
          },
        ],
      },
    ]);
    const second = collectWriteToolCompletionEvents(
      messages,
      new Set(["tc_1"])
    );
    expect(second).toEqual([]);
  });

  it("ignores approval-requested / denied / non-write parts", () => {
    const messages: OrgChatMessage[] = [
      assistantWithWriteTool("delete_product", {
        state: "approval-requested",
        input: { id: "p1" },
        output: undefined,
      }),
      {
        id: "m2",
        role: "assistant",
        parts: [
          {
            type: "tool-delegate",
            toolCallId: "tc_d",
            state: "output-available",
            input: { task: "research" },
            output: { summary: "done" },
          },
        ],
      } as OrgChatMessage,
      assistantWithWriteTool("list_products", {
        toolCallId: "tc_list",
        input: {},
        output: { ok: true, data: [] },
      }),
    ];
    expect(collectWriteToolCompletionEvents(messages, new Set())).toEqual([]);
  });

  it("skips ToolResult ok:false outputs", () => {
    const messages = [
      assistantWithWriteTool("delete_product", {
        input: { id: "missing" },
        output: { ok: false, error: "not found", code: "not_found" },
      }),
    ];
    expect(collectWriteToolCompletionEvents(messages, new Set())).toEqual([]);
  });
});

describe("collectWriteToolCompletionEvents — codemode execute calls", () => {
  function assistantWithExecute(
    output: unknown,
    toolCallId = "tc_exec"
  ): OrgChatMessage {
    return {
      id: "m1",
      role: "assistant",
      parts: [
        {
          type: "tool-execute",
          toolCallId,
          state: "output-available",
          input: { code: "await tools.update_product(...)" },
          output,
        },
      ],
    } as OrgChatMessage;
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
          {
            seq: 1,
            connector: "tools",
            method: "list_products",
            args: {},
            requiresApproval: false,
            state: "applied",
          },
          appliedUpdate,
        ],
      }),
    ];
    const events = collectWriteToolCompletionEvents(messages, new Set());
    expect(events).toEqual([
      {
        eventId: "tc_exec:calls",
        writes: [
          {
            method: "update_product",
            args: { id: "prod_9", data: { price: 949 } },
          },
        ],
      },
    ]);
    // Deduped on the next scan.
    expect(
      collectWriteToolCompletionEvents(messages, new Set(["tc_exec:calls"]))
    ).toEqual([]);
  });

  it("ignores paused runs, non-applied entries and unregistered methods", () => {
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
    expect(collectWriteToolCompletionEvents(messages, new Set())).toEqual([]);
  });
});

describe("invalidateForAgentWrite", () => {
  it("create invalidates list prefix only", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;
    expect(
      invalidateForAgentWrite(queryClient, {
        method: "create_product",
        args: { name: "X" },
      })
    ).toBe(true);
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("update invalidates list + detail", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;
    invalidateForAgentWrite(queryClient, {
      method: "update_product",
      args: { id: "prod_1", data: { name: "Y" } },
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products"],
    });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products", "prod_1"],
    });
  });

  it("ignores read-only tool names (AC-4)", () => {
    const queryClient = {
      invalidateQueries: vi.fn(),
    } as unknown as QueryClient;
    expect(
      invalidateForAgentWrite(queryClient, {
        method: "list_products",
        args: {},
      })
    ).toBe(false);
    expect(
      invalidateForAgentWrite(queryClient, {
        method: "get_product",
        args: { id: "x" },
      })
    ).toBe(false);
    expect(
      invalidateForAgentWrite(queryClient, {
        method: "display_product_list",
        args: {},
      })
    ).toBe(false);
    expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
  });
});

describe("applyWriteToolCompletionInvalidations", () => {
  it("invalidates for update_product from tool input", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    applyWriteToolCompletionInvalidations({
      events: [
        {
          eventId: "tc_update",
          writes: [
            {
              method: "update_product",
              args: { id: "seed-prod-widget", data: { name: "ALW500-QA" } },
            },
          ],
        },
      ],
      queryClient,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products", "seed-prod-widget"],
    });
  });

  it("invalidates for create_product", () => {
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    applyWriteToolCompletionInvalidations({
      events: [
        {
          eventId: "tc_create",
          writes: [
            {
              method: "create_product",
              args: { name: "New", description: "Fresh", price: 1 },
            },
          ],
        },
      ],
      queryClient,
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["products"],
    });
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it("dedupes by toolCallId via handled set", () => {
    const handled = new Set<string>();
    const invalidateQueries = vi.fn();
    const queryClient = { invalidateQueries } as unknown as QueryClient;

    const events = [
      {
        eventId: "tc_once",
        writes: [
          {
            method: "create_product",
            args: { name: "A", description: "First", price: 1 },
          },
        ],
      },
    ];

    applyWriteToolCompletionInvalidations({
      events,
      handled,
      queryClient,
    });
    applyWriteToolCompletionInvalidations({
      events,
      handled,
      queryClient,
    });

    expect(handled.has("tc_once")).toBe(true);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
