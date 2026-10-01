import type { ChatSummary } from "@workspace/agent/types";
import { describe, expect, it } from "vitest";
import { chatRouteState, deriveChatsLoadState } from "./chat-route";

const chats: ChatSummary[] = [
  { id: "a", title: "A", createdAt: 1, updatedAt: 2 },
  { id: "b", title: "B", createdAt: 1, updatedAt: 1 },
];

describe("chatRouteState", () => {
  it("stays loading until the chat list has loaded (no premature not-found)", () => {
    expect(chatRouteState("zzz", "loading", [])).toBe("loading");
    expect(chatRouteState("zzz", "error", [])).toBe("loading");
  });

  it("opens a chat that is in the loaded org state", () => {
    expect(chatRouteState("a", "ready", chats)).toBe("open");
  });

  it("marks an unknown id once the list is loaded", () => {
    expect(chatRouteState("zzz", "ready", chats)).toBe("not-found");
  });
});

describe("deriveChatsLoadState", () => {
  it("stays loading until the state frame arrives (identity alone is not ready)", () => {
    expect(deriveChatsLoadState(null, undefined)).toBe("loading");
  });

  it("turns ready once the state frame arrives, even when the list is empty", () => {
    expect(deriveChatsLoadState(null, { chats: [] })).toBe("ready");
  });

  it("a terminal connection error wins over any state", () => {
    expect(deriveChatsLoadState(new Error("closed"), undefined)).toBe("error");
    expect(deriveChatsLoadState(new Error("closed"), { chats })).toBe("error");
  });
});
