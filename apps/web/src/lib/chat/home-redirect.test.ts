import type { ChatSummary } from "@workspace/agent/types";
import { describe, expect, it } from "vitest";
import { homeRedirectTarget } from "./home-redirect";

const chat = (id: string): ChatSummary => ({
  createdAt: 0,
  id,
  title: id,
  updatedAt: 0,
});

describe("homeRedirectTarget", () => {
  it("opens the newest chat when the list is ready and non-empty", () => {
    expect(homeRedirectTarget("ready", [chat("b"), chat("a")])).toEqual({
      kind: "chat",
      chatId: "b",
    });
  });

  it("opens the new-chat draft when the org has no chats", () => {
    expect(homeRedirectTarget("ready", [])).toEqual({ kind: "draft" });
  });

  it("opens the draft when the chat list failed to load", () => {
    expect(homeRedirectTarget("error", [])).toEqual({ kind: "draft" });
  });

  it("waits while the list is loading", () => {
    expect(homeRedirectTarget("loading", [])).toBeNull();
  });
});
