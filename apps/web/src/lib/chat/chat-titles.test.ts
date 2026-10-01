import { describe, expect, it } from "vitest";
import { defaultNewChatTitle, deriveTitleFromMessage } from "./chat-titles";

describe("deriveTitleFromMessage", () => {
  it("uses the text part, collapsed whitespace", () => {
    expect(
      deriveTitleFromMessage([{ type: "text", text: "  list   my\nproducts " }])
    ).toBe("list my products");
  });

  it("strips fenced and inline code before titling", () => {
    expect(
      deriveTitleFromMessage([
        {
          type: "text",
          text: "fix `formatMinor` please\n```ts\nconst a = 1;\n```",
        },
      ])
    ).toBe("fix formatMinor please");
  });

  it("clamps long messages to 48 chars: 47 text + ellipsis", () => {
    const title = deriveTitleFromMessage([
      { type: "text", text: "a".repeat(80) },
    ]);
    expect(title).toHaveLength(48);
    expect(title?.endsWith("…")).toBe(true);
  });

  it("ignores attachment-only messages", () => {
    expect(deriveTitleFromMessage([{ type: "file" }])).toBeUndefined();
  });

  it("draft rows start as the generic new-chat title", () => {
    expect(defaultNewChatTitle()).toBe("New chat");
  });
});
