export type DockFocus = { kind: "draft" } | { kind: "chat"; chatId: string };

export type DockSize = "popup" | "fullscreen";

export interface DockState {
  bodyOpen: boolean;
  focus: DockFocus | null;
  /** Open chats that have a tab. A draft is not in this list. */
  openChatIds: string[];
  size: DockSize;
}

export type DockAction =
  | { type: "open-draft" }
  | { type: "open-chat"; chatId: string }
  | { type: "minimize" }
  | { type: "dismiss-draft" }
  | { type: "close-chat"; chatId: string }
  | { type: "set-size"; size: DockSize };

export const initialDockState: DockState = {
  bodyOpen: false,
  focus: null,
  openChatIds: [],
  size: "popup",
};

const CHAT_ID_PATH = /^\/chat\/[^/]+$/;

/** A chat URL is a deep link into the dock. App pages are everything else. */
function isChatPath(pathname: string): boolean {
  return pathname === "/chat/new" || CHAT_ID_PATH.test(pathname);
}

/**
 * App pages keep their URL when the dock opens. A chat URL is a deep link,
 * so it follows the focused tab — a refresh would otherwise reopen the
 * previous chat while the dock showed a different one.
 */
export function chatPathToSync(
  pathname: string,
  target: DockFocus
): string | null {
  if (!isChatPath(pathname)) {
    return null;
  }
  if (target.kind === "draft") {
    return pathname === "/chat/new" ? null : "/chat/new";
  }
  const next = `/chat/${target.chatId}`;
  return pathname === next ? null : next;
}

export function dockReducer(state: DockState, action: DockAction): DockState {
  switch (action.type) {
    case "open-draft":
      return { ...state, bodyOpen: true, focus: { kind: "draft" } };
    case "open-chat":
      return {
        ...state,
        bodyOpen: true,
        focus: { kind: "chat", chatId: action.chatId },
        openChatIds: [
          ...state.openChatIds.filter((id) => id !== action.chatId),
          action.chatId,
        ],
      };
    case "minimize":
      return { ...state, bodyOpen: false };
    case "dismiss-draft":
      if (state.focus?.kind !== "draft") {
        return state;
      }
      return { ...state, bodyOpen: false, focus: null };
    case "close-chat": {
      const openChatIds = state.openChatIds.filter(
        (id) => id !== action.chatId
      );
      const closing =
        state.focus?.kind === "chat" && state.focus.chatId === action.chatId;
      if (!closing) {
        return { ...state, openChatIds };
      }
      const next = openChatIds.at(-1);
      if (!next) {
        return { ...state, bodyOpen: false, focus: null, openChatIds };
      }
      return {
        ...state,
        bodyOpen: true,
        focus: { kind: "chat", chatId: next },
        openChatIds,
      };
    }
    case "set-size":
      return { ...state, size: action.size };
    default:
      return state;
  }
}
