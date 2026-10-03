import { describe, expect, it } from "vitest";
import { mintChatId } from "./chat-id";

const CHAT_ID_PATTERN = /^[0-9a-f]{16}$/;

describe("mintChatId", () => {
  it("is 16 lowercase hex characters", () => {
    expect(mintChatId()).toMatch(CHAT_ID_PATTERN);
  });
});
