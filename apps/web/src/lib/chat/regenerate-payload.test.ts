import { Chat } from "@ai-sdk/react";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { describe, expect, it } from "vitest";

/**
 * `useAgentChat` → `useChat` → `Chat.regenerate` slices the assistant message
 * off local state before `sendMessages`. The agents WebSocket transport
 * forwards that array as the chat-request body (`messages` + `trigger`).
 * This pins the payload our client sends: the answer being replaced is not in it.
 */
describe("regenerate payload", () => {
  it("omits the assistant message being replaced", async () => {
    let sent: { messages: UIMessage[]; trigger: string } | undefined;
    const transport: ChatTransport<UIMessage> = {
      sendMessages(options) {
        sent = {
          messages: options.messages,
          trigger: options.trigger,
        };
        return Promise.resolve(
          new ReadableStream<UIMessageChunk>({
            start(controller) {
              controller.close();
            },
          })
        );
      },
      reconnectToStream() {
        return Promise.resolve(null);
      },
    };

    const user: UIMessage = {
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "hi" }],
    };
    const assistant: UIMessage = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "That response was already complete." }],
    };
    const chat = new Chat<UIMessage>({
      messages: [user, assistant],
      transport,
    });

    await chat.regenerate({ messageId: "a1" });

    expect(sent?.trigger).toBe("regenerate-message");
    expect(sent?.messages.map((message) => message.id)).toEqual(["u1"]);
    expect(sent?.messages.some((message) => message.role === "assistant")).toBe(
      false
    );
  });
});
