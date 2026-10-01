// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrgChatMessage } from "@/lib/chat/ai-types";
import { ChatMessageRow } from "./chat-message-row";

const UPDATE_PRODUCT_HEADER = /Update Product/;
const EXECUTE_HEADER = /^Execute/;
const UPDATED_PRICE = /4242/;

vi.mock("streamdown", () => ({
  Streamdown: ({ children }: { children?: string }) => <div>{children}</div>,
}));

afterEach(() => {
  cleanup();
});

function message(
  state: "input-streaming" | "approval-requested" | "output-available",
  tool: "update_product" | "execute"
): OrgChatMessage {
  const approval =
    state === "approval-requested" ? { approval: { id: "ap-1" } } : {};
  const part =
    tool === "execute"
      ? {
          type: "tool-execute" as const,
          toolCallId: "call-1",
          state,
          input: { code: "await update()" },
          ...approval,
        }
      : {
          type: "tool-update_product" as const,
          toolCallId: "call-1",
          state,
          input: { id: "Widget", data: { price: 4242 } },
          output:
            state === "output-available"
              ? { ok: true, data: { price: 4242 } }
              : undefined,
          ...approval,
        };
  return {
    id: "m1",
    role: "assistant",
    parts: [{ type: "text", text: "Updating the price." }, part],
  } as OrgChatMessage;
}

function renderRow(value: OrgChatMessage) {
  return render(
    <ChatMessageRow message={value} onToolApproval={() => undefined} />
  );
}

function header(name: RegExp) {
  return screen.getByRole("button", { name });
}

describe("approval tool card", () => {
  it("opens an update_product card when approval is requested and still toggles after", () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });

    const { rerender } = renderRow(
      message("input-streaming", "update_product")
    );
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(header(UPDATE_PRODUCT_HEADER).getAttribute("aria-expanded")).toBe(
      "false"
    );

    rerender(
      <ChatMessageRow
        message={message("approval-requested", "update_product")}
        onToolApproval={() => undefined}
      />
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(header(UPDATE_PRODUCT_HEADER).getAttribute("aria-expanded")).toBe(
      "true"
    );

    fireEvent.click(header(UPDATE_PRODUCT_HEADER));
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
    expect(header(UPDATE_PRODUCT_HEADER).getAttribute("aria-expanded")).toBe(
      "true"
    );
    expect(errors.filter((error) => error.includes("default open"))).toEqual(
      []
    );

    rerender(
      <ChatMessageRow
        message={message("output-available", "update_product")}
        onToolApproval={() => undefined}
      />
    );
    expect(screen.queryAllByText(UPDATED_PRICE)).toEqual([]);
    const settled = header(UPDATE_PRODUCT_HEADER);
    fireEvent.click(settled);
    expect(screen.queryAllByText(UPDATED_PRICE).length).toBeGreaterThan(0);
    fireEvent.click(settled);
    expect(screen.queryAllByText(UPDATED_PRICE)).toEqual([]);

    spy.mockRestore();
  });

  it("opens an execute card when approval is requested", () => {
    const { rerender } = renderRow(message("input-streaming", "execute"));
    expect(header(EXECUTE_HEADER).getAttribute("aria-expanded")).toBe("false");

    rerender(
      <ChatMessageRow
        message={message("approval-requested", "execute")}
        onToolApproval={() => undefined}
      />
    );
    const trigger = header(EXECUTE_HEADER);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(header(EXECUTE_HEADER).getAttribute("aria-expanded")).toBe("true");
  });
});
