import type { ChatSummary } from "@workspace/agent/types";

/**
 * Where `/` should send the member: the most recent chat, or the new-chat
 * draft (`/chat/new`). A draft needs no chat list, so a failed `listChats`
 * still lands somewhere useful instead of spinning forever; the sidebar
 * offers Retry for the list itself. `null` keeps the spinner while loading.
 */
export type HomeRedirectTarget =
  | { kind: "chat"; chatId: string }
  | { kind: "draft" };

export function homeRedirectTarget(
  chatsLoadState: "loading" | "ready" | "error",
  chats: ChatSummary[]
): HomeRedirectTarget | null {
  if (chatsLoadState === "loading") {
    return null;
  }
  const chatId = chats[0]?.id;
  return chatId ? { kind: "chat", chatId } : { kind: "draft" };
}
