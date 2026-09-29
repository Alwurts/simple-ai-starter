import type { ChatSummary } from "@workspace/agent/types";
import { describe, expect, it } from "vitest";
import { homeRedirectChatId } from "./home-redirect";

const chat = (id: string): ChatSummary => ({
  createdAt: 0,
  id,
  title: id,
  updatedAt: 0,
});

describe("homeRedirectChatId", () => {
  it("opens the newest chat when the list is ready and non-empty", () => {
    expect(homeRedirectChatId("ready", [chat("b"), chat("a")])).toBe("b");
  });

  it("opens the new-chat draft when the org has no chats", () => {
    expect(homeRedirectChatId("ready", [])).toBe("new");
  });

  it("opens the draft when the chat list failed to load", () => {
    expect(homeRedirectChatId("error", [])).toBe("new");
  });

  it("waits while the list is loading", () => {
    expect(homeRedirectChatId("loading", [])).toBeNull();
  });
});
