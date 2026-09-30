import type { ChatSummary } from "@workspace/agent/types";

export type ChatRouteState = "loading" | "open" | "not-found";

/**
 * Route decision for `/chat/$chatId`. The `onBeforeSubAgent` 404 on the
 * socket upgrade arrives as a non-terminal close (partysocket reconnects
 * forever, `connectionError` never fires), so an unknown id is detected from
 * the org state's loaded chat list instead — and the chat socket is never
 * opened for it. The decision only runs once the list has loaded, so a slow
 * state broadcast can't flash "not found".
 */
export function chatRouteState(
  chatId: string,
  chatsLoadState: "loading" | "ready" | "error",
  chats: ChatSummary[]
): ChatRouteState {
  if (chatsLoadState !== "ready") {
    return "loading";
  }
  return chats.some((chat) => chat.id === chatId) ? "open" : "not-found";
}
