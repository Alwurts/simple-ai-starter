"use client";

import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
} from "react";
import { flushSync } from "react-dom";
import {
  chatPathToSync,
  type DockAction,
  type DockFocus,
  dockReducer,
  initialDockState,
} from "@/lib/chat/dock-state";

interface ChatDockApi {
  state: typeof initialDockState;
  openDraft: () => void;
  openChat: (chatId: string) => void;
  minimize: () => void;
  toggleSize: () => void;
  /** Close the focused draft or chat tab. Does not delete the chat. */
  closeFocused: () => void;
  /**
   * Drop a chat tab. Closing the focused chat hides the window and does not
   * open another one. When this page is that chat's URL, go home before the
   * caller deletes it.
   */
  releaseChat: (chatId: string) => Promise<void>;
  /** The draft's first send stored this id. Show it, and keep a chat URL in sync. */
  promoteDraft: (chatId: string) => void;
}

const ChatDockContext = createContext<ChatDockApi | null>(null);

export function ChatDockProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dockReducer, initialDockState);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathnameRef = useRef(pathname);
  const stateRef = useRef(state);
  pathnameRef.current = pathname;
  stateRef.current = state;

  const send = useCallback((action: DockAction) => {
    dispatch(action);
  }, []);

  const followChatPath = useCallback(
    (target: DockFocus) => {
      const next = chatPathToSync(pathnameRef.current, target);
      if (next === "/chat/new") {
        navigate({ to: "/chat/new" });
        return;
      }
      if (next?.startsWith("/chat/")) {
        navigate({
          params: { chatId: next.slice("/chat/".length) },
          to: "/chat/$chatId",
        });
      }
    },
    [navigate]
  );

  const openDraft = useCallback(() => {
    send({ type: "open-draft" });
    followChatPath({ kind: "draft" });
  }, [followChatPath, send]);

  const openChat = useCallback(
    (chatId: string) => {
      send({ type: "open-chat", chatId });
      followChatPath({ kind: "chat", chatId });
    },
    [followChatPath, send]
  );

  const minimize = useCallback(() => {
    send({ type: "minimize" });
  }, [send]);

  const toggleSize = useCallback(() => {
    send({
      type: "set-size",
      size: stateRef.current.size === "fullscreen" ? "popup" : "fullscreen",
    });
  }, [send]);

  const releaseChat = useCallback(
    async (chatId: string) => {
      const path = pathnameRef.current;
      flushSync(() => {
        dispatch({ type: "close-chat", chatId });
      });
      if (path !== `/chat/${chatId}`) {
        return;
      }
      await navigate({ to: "/" });
    },
    [navigate]
  );

  const closeFocused = useCallback(() => {
    const focus = stateRef.current.focus;
    if (focus?.kind === "chat") {
      releaseChat(focus.chatId);
      return;
    }
    if (focus?.kind === "draft") {
      send({ type: "dismiss-draft" });
      if (pathnameRef.current === "/chat/new") {
        navigate({ to: "/" });
      }
    }
  }, [navigate, releaseChat, send]);

  const promoteDraft = useCallback(
    (chatId: string) => {
      send({ type: "open-chat", chatId });
      if (pathnameRef.current === "/chat/new") {
        navigate({
          params: { chatId },
          replace: true,
          to: "/chat/$chatId",
        });
      }
    },
    [navigate, send]
  );

  const api = useMemo<ChatDockApi>(
    () => ({
      state,
      openDraft,
      openChat,
      minimize,
      toggleSize,
      closeFocused,
      releaseChat,
      promoteDraft,
    }),
    [
      state,
      openDraft,
      openChat,
      minimize,
      toggleSize,
      closeFocused,
      releaseChat,
      promoteDraft,
    ]
  );

  return (
    <ChatDockContext.Provider value={api}>{children}</ChatDockContext.Provider>
  );
}

export function useChatDock(): ChatDockApi {
  const dock = useContext(ChatDockContext);
  if (!dock) {
    throw new Error("useChatDock must be used inside ChatDockProvider");
  }
  return dock;
}
