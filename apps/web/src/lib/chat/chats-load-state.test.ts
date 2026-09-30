import { describe, expect, it } from "vitest";
import { deriveChatsLoadState } from "./chats-load-state";

describe("deriveChatsLoadState", () => {
  it("stays loading on identity alone — the state frame may not have arrived", () => {
    expect(
      deriveChatsLoadState({ connectionError: null, stateArrived: false })
    ).toBe("loading");
  });

  it("is ready once the state frame arrived, even with an empty list", () => {
    expect(
      deriveChatsLoadState({
        connectionError: null,
        stateArrived: true,
      })
    ).toBe("ready");
  });

  it("a terminal connection error wins", () => {
    expect(
      deriveChatsLoadState({
        connectionError: new Error("closed"),
        stateArrived: false,
      })
    ).toBe("error");
  });
});
