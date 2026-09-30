import type { useAgentChat } from "@cloudflare/think/react";
import type { AIDataPart, AIMetadata } from "@workspace/contract/ai";
import type { UIMessage } from "ai";

export interface OrgChatMessage extends UIMessage<AIMetadata, AIDataPart> {}

export type ChatHelpers = ReturnType<
  typeof useAgentChat<unknown, OrgChatMessage>
>;

export interface OutgoingUserMessage {
  parts: OrgChatMessage["parts"];
  role: "user";
}

/** A user message is sendable as-is (the hook accepts a user UIMessage). */
export function toSendableMessage(
  message: OutgoingUserMessage
): Parameters<ChatHelpers["sendMessage"]>[0] {
  return message as Parameters<ChatHelpers["sendMessage"]>[0];
}
