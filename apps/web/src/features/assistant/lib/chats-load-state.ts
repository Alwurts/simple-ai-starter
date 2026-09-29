export type ChatsLoadState = "loading" | "ready" | "error";

/**
 * Sidebar chat-list readiness. Agents delivers the identity frame before the
 * state frame, so socket identity alone can race an empty list — `ready` must
 * mean the state frame arrived (it always carries the full chat list, even
 * when empty). A terminal connection error wins.
 */
export function deriveChatsLoadState(input: {
  connectionError: unknown;
  stateArrived: boolean;
}): ChatsLoadState {
  if (input.connectionError) {
    return "error";
  }
  return input.stateArrived ? "ready" : "loading";
}
