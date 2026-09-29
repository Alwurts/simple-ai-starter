import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { describe, expect, it } from "vitest";
import {
  getToolName,
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
