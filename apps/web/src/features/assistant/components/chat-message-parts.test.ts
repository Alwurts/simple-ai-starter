import { splitWorkedParts } from "@workspace/ui/components/shadcn/worked";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { describe, expect, it } from "vitest";
import { getToolName } from "../lib/tool-name";
import {
  isCollapsedWorkedPart,
  isPausedExecutionPart,
  isProductListCardPart,
  PRODUCT_LIST_TOOL_NAME,
} from "./chat-message-parts";

function toolPart(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    type: "tool-display_product_list",
    toolCallId: "tc_1",
    state: "output-available",
    input: {},
    output: { productIds: ["p1"] },
    ...overrides,
  } as unknown as ToolUIPart;
}

describe("getToolName", () => {
  it("prefers the dynamic toolName field", () => {
    const part = {
      type: "dynamic-tool",
      toolName: "delegate",
    } as unknown as DynamicToolUIPart;
    expect(getToolName(part)).toBe("delegate");
  });

  it("slices the tool- prefix off typed parts", () => {
    expect(getToolName(toolPart())).toBe(PRODUCT_LIST_TOOL_NAME);
  });
});

describe("isProductListCardPart", () => {
  it("renders the card only for a completed display_product_list echo", () => {
    expect(isProductListCardPart(toolPart())).toBe(true);
  });

  it("falls back to the generic row while running", () => {
    expect(
      isProductListCardPart(
        toolPart({ state: "input-available", output: undefined })
      )
    ).toBe(false);
  });

  it("falls back to the generic row for every other tool", () => {
    expect(
      isProductListCardPart(
        toolPart({ type: "tool-display_memory", output: { content: "…" } })
      )
    ).toBe(false);
    expect(
      isProductListCardPart(
        toolPart({ type: "tool-write_workspace_file", output: { ok: true } })
      )
    ).toBe(false);
    expect(
      isProductListCardPart(
        toolPart({ type: "dynamic-tool", toolName: "delegate", output: {} })
      )
    ).toBe(false);
  });
});

function kindsOf(
  parts: Array<{
    type: string;
    state?: string;
    toolName?: string;
    text?: string;
    toolCallId?: string;
    input?: unknown;
    output?: unknown;
    approval?: { id: string };
  }>
) {
  return splitWorkedParts(parts, isCollapsedWorkedPart).map((segment) => {
    if (segment.kind === "worked") {
      return {
        kind: "worked" as const,
        types: segment.items.map((item) => item.part.type),
      };
    }
    return { kind: "visible" as const, type: segment.item.part.type };
  });
}

describe("assistant part grouping", () => {
  it("renders a pending approval outside the collapsed group", () => {
    expect(
      kindsOf([
        { type: "reasoning", text: "checking" },
        {
          type: "tool-delete_product",
          state: "approval-requested",
          toolCallId: "tc_del",
          input: { id: "p1" },
          approval: { id: "ap_1" },
        },
        { type: "text", text: "Say if I should delete it." },
      ])
    ).toEqual([
      { kind: "worked", types: ["reasoning"] },
      { kind: "visible", type: "tool-delete_product" },
      { kind: "visible", type: "text" },
    ]);
  });

  it("renders a display_product_list card outside the collapsed group", () => {
    expect(
      kindsOf([
        {
          type: "tool-list_products",
          state: "output-available",
          toolCallId: "tc_list",
          input: {},
          output: { ok: true },
        },
        {
          type: "tool-display_product_list",
          state: "output-available",
          toolCallId: "tc_card",
          input: {},
          output: { productIds: ["p1"] },
        },
        { type: "text", text: "Shown above." },
      ])
    ).toEqual([
      { kind: "worked", types: ["tool-list_products"] },
      { kind: "visible", type: "tool-display_product_list" },
      { kind: "visible", type: "text" },
    ]);
  });

  it("keeps data tools inside the collapsed group", () => {
    expect(
      kindsOf([
        {
          type: "tool-list_products",
          state: "output-available",
          toolCallId: "tc_list",
        },
        {
          type: "dynamic-tool",
          toolName: "delegate",
          state: "output-available",
          toolCallId: "tc_del",
        },
        {
          type: "tool-set_context",
          state: "output-available",
          toolCallId: "tc_ctx",
        },
        { type: "text", text: "Done." },
      ])
    ).toEqual([
      {
        kind: "worked",
        types: ["tool-list_products", "dynamic-tool", "tool-set_context"],
      },
      { kind: "visible", type: "text" },
    ]);
  });

  it("folds an approval back into the group once it is no longer requested", () => {
    expect(
      kindsOf([
        {
          type: "tool-update_product",
          state: "output-available",
          toolCallId: "tc_upd",
        },
        { type: "text", text: "Updated." },
      ])
    ).toEqual([
      { kind: "worked", types: ["tool-update_product"] },
      { kind: "visible", type: "text" },
    ]);
  });
});

describe("codemode execute part (D-010)", () => {
  const pausedPart = {
    type: "tool-execute",
    state: "output-available",
    toolCallId: "tc_exec",
    input: { code: "return 1;" },
    output: {
      status: "paused",
      executionId: "ex_1",
      pending: [
        {
          executionId: "ex_1",
          seq: 1,
          connector: "tools",
          method: "update_product",
        },
      ],
    },
  };

  it("keeps a paused execution outside the collapsed group so it is actionable", () => {
    expect(
      kindsOf([
        { type: "reasoning", text: "planning" },
        pausedPart,
        { type: "text", text: "I need your approval." },
      ])
    ).toEqual([
      { kind: "worked", types: ["reasoning"] },
      { kind: "visible", type: "tool-execute" },
      { kind: "visible", type: "text" },
    ]);
  });

  it("folds the execution back in once it completes", () => {
    expect(
      kindsOf([
        {
          ...pausedPart,
          output: { status: "completed", executionId: "ex_1", result: 1 },
        },
        { type: "text", text: "Done." },
      ])
    ).toEqual([
      { kind: "worked", types: ["tool-execute"] },
      { kind: "visible", type: "text" },
    ]);
  });

  it("detects only paused execute outputs", () => {
    expect(isPausedExecutionPart(pausedPart)).toBe(true);
    expect(
      isPausedExecutionPart({
        ...pausedPart,
        output: { status: "completed", executionId: "ex_1" },
      })
    ).toBe(false);
    expect(
      isPausedExecutionPart({
        type: "tool-list_products",
        state: "output-available",
        output: { ok: true },
      })
    ).toBe(false);
  });
});
