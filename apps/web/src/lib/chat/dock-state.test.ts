import { describe, expect, it } from "vitest";
import { chatPathToSync, dockReducer, initialDockState } from "./dock-state";

describe("dockReducer", () => {
  it("opens a draft without a pill", () => {
    expect(dockReducer(initialDockState, { type: "open-draft" })).toEqual({
      bodyOpen: true,
      focus: { kind: "draft" },
      openChatIds: [],
      size: "popup",
    });
  });

  it("gives a chat a pill and focuses it", () => {
    const draft = dockReducer(initialDockState, { type: "open-draft" });
    expect(dockReducer(draft, { type: "open-chat", chatId: "a" })).toEqual({
      bodyOpen: true,
      focus: { kind: "chat", chatId: "a" },
      openChatIds: ["a"],
      size: "popup",
    });
  });

  it("minimize keeps the pill and the focus", () => {
    const open = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    const minimized = dockReducer(open, { type: "minimize" });
    expect(minimized.bodyOpen).toBe(false);
    expect(minimized.focus).toEqual({ kind: "chat", chatId: "a" });
    expect(minimized.openChatIds).toEqual(["a"]);
  });

  it("reopening a chat does not duplicate its pill", () => {
    let state = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    state = dockReducer(state, { type: "minimize" });
    state = dockReducer(state, { type: "open-chat", chatId: "a" });
    expect(state.openChatIds).toEqual(["a"]);
    expect(state.bodyOpen).toBe(true);
  });

  it("closing the focused chat focuses the previous pill", () => {
    let state = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    state = dockReducer(state, { type: "open-chat", chatId: "b" });
    state = dockReducer(state, { type: "close-chat", chatId: "b" });
    expect(state.openChatIds).toEqual(["a"]);
    expect(state.focus).toEqual({ kind: "chat", chatId: "a" });
    expect(state.bodyOpen).toBe(true);
  });

  it("closing the last chat clears the window", () => {
    const open = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    expect(dockReducer(open, { type: "close-chat", chatId: "a" })).toEqual({
      bodyOpen: false,
      focus: null,
      openChatIds: [],
      size: "popup",
    });
  });

  it("moves a reopened chat to the end of the pills", () => {
    let state = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    state = dockReducer(state, { type: "open-chat", chatId: "b" });
    state = dockReducer(state, { type: "open-chat", chatId: "a" });
    expect(state.openChatIds).toEqual(["b", "a"]);
    expect(state.focus).toEqual({ kind: "chat", chatId: "a" });
  });

  it("closing a background chat keeps the focused one", () => {
    let state = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    state = dockReducer(state, { type: "open-chat", chatId: "b" });
    state = dockReducer(state, { type: "close-chat", chatId: "a" });
    expect(state.openChatIds).toEqual(["b"]);
    expect(state.focus).toEqual({ kind: "chat", chatId: "b" });
    expect(state.bodyOpen).toBe(true);
  });

  it("dismisses a draft and leaves real pills alone", () => {
    const withChat = dockReducer(initialDockState, {
      type: "open-chat",
      chatId: "a",
    });
    const draft = dockReducer(withChat, { type: "open-draft" });
    const dismissed = dockReducer(draft, { type: "dismiss-draft" });
    expect(dismissed.focus).toBeNull();
    expect(dismissed.bodyOpen).toBe(false);
    expect(dismissed.openChatIds).toEqual(["a"]);
  });
});

describe("chatPathToSync", () => {
  it("leaves an app page on its URL", () => {
    expect(chatPathToSync("/catalog", { kind: "draft" })).toBeNull();
    expect(chatPathToSync("/", { kind: "chat", chatId: "a" })).toBeNull();
    expect(
      chatPathToSync("/settings/general", { kind: "chat", chatId: "a" })
    ).toBeNull();
  });

  it("follows the focused tab when the page is already a chat URL", () => {
    expect(chatPathToSync("/chat/a", { kind: "chat", chatId: "a" })).toBeNull();
    expect(chatPathToSync("/chat/a", { kind: "chat", chatId: "b" })).toBe(
      "/chat/b"
    );
    expect(chatPathToSync("/chat/a", { kind: "draft" })).toBe("/chat/new");
    expect(chatPathToSync("/chat/new", { kind: "draft" })).toBeNull();
    expect(chatPathToSync("/chat/new", { kind: "chat", chatId: "a" })).toBe(
      "/chat/a"
    );
  });
});
