import type { ChatSummary } from "@workspace/agent/types";

/**
 * Where `/` should send the member. A draft needs no chat list, so a failed
 * `listChats` still lands somewhere useful (`/chat/new`) instead of spinning
 * forever; the sidebar offers Retry for the list itself.
 */
export function homeRedirectChatId(
  chatsLoadState: "loading" | "ready" | "error",
  chats: ChatSummary[]
): string | null {
  if (chatsLoadState === "loading") {
    return null;
  }
  return chats[0]?.id ?? "new";
}
