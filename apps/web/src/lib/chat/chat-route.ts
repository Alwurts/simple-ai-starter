import type { ChatSummary, OrgAgentState } from "@workspace/agent/types";

export type ChatRouteState = "loading" | "open" | "not-found";

export type ChatsLoadState = "loading" | "ready" | "error";

/**
 * Sidebar chat-list readiness. Agents delivers the identity frame before the
 * state frame, so `ready` must mean the state frame arrived — it always
 * carries the full chat list, even when empty (`ready` with an empty list
 * would redirect `/` to the draft and flash "Chat not found" on real chats).
 * A terminal connection error wins.
 */
export function deriveChatsLoadState(
  connectionError: unknown,
  state: OrgAgentState | undefined
): ChatsLoadState {
  if (connectionError) {
    return "error";
  }
  return state === undefined ? "loading" : "ready";
}

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
  chatsLoadState: ChatsLoadState,
  chats: ChatSummary[]
): ChatRouteState {
  if (chatsLoadState !== "ready") {
    return "loading";
  }
  return chats.some((chat) => chat.id === chatId) ? "open" : "not-found";
}
