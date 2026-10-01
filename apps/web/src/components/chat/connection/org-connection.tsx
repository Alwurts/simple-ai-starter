"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { OrgAgent } from "@workspace/agent/org";
import type {
  ChatSearchHit,
  ChatSummary,
  OrgAgentState,
  WorkspaceFileInfo,
} from "@workspace/agent/types";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { useAgent } from "agents/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { OutgoingUserMessage } from "@/lib/chat/ai-types";
import { deriveChatsLoadState } from "@/lib/chat/chat-route";
import { workspaceQueryKey } from "@/lib/chat/workspace-query-key";

interface OrgConnectionValue {
  /** All chats of the active org, newest first (OrgAgent state order). */
  chats: ChatSummary[];
  chatsLoadState: "loading" | "ready" | "error";
  createChat: (opts?: { title?: string }) => Promise<ChatSummary>;
  deleteChat: (chatId: string) => Promise<void>;
  /** Retitle a chat (`OrgAgent.renameChat`); throws after toasting. */
  renameChat: (chatId: string, title: string) => Promise<void>;
  /** FTS search over the org's chats (`OrgAgent.searchChats`). */
  searchChats: (query: string) => Promise<ChatSearchHit[]>;
  /** Retry after a terminal close: force the built-in reconnection. */
  retryConnection: () => void;
  /**
   * Draft bridged across the draft → createChat → navigate hand-off, tied to
   * the chat it was created for so a fast chat switch can't flush it into
   * another conversation.
   */
  pendingMessage: { chatId: string; message: OutgoingUserMessage } | null;
  clearPendingMessage: () => void;
  setPendingMessage: (chatId: string, message: OutgoingUserMessage) => void;
  /** Read-only workspace listing for the file viewer (defaults to root). */
  listWorkspace: (path?: string) => Promise<WorkspaceFileInfo[]>;
  organizationId: string;
  /** Read a workspace file's text contents (null when absent/binary). */
  readWorkspaceFile: (path: string) => Promise<string | null>;
}

const OrgConnectionContext = createContext<OrgConnectionValue | null>(null);

export function useOrgConnection() {
  const ctx = useContext(OrgConnectionContext);
  if (!ctx) {
    throw new Error("useOrgConnection must be used within <OrgConnection />");
  }
  return ctx;
}

export interface OrgConnectionProps {
  children: ReactNode;
  organizationId: string;
}

/**
 * One shared WebSocket to the active org's `OrgAgent` for the whole protected
 * area: the sidebar thread list and the chat page's workspace panel talk to it
 * over typed stubs, while each chat's transcript streams over its own
 * `sub: [OrgChat]` connection (see the chat feature). The socket also carries
 * the `workspace-change` broadcast that keeps workspace viewers live.
 */
export function OrgConnection({
  organizationId,
  children,
}: OrgConnectionProps) {
  const queryClient = useQueryClient();
  const [pendingMessage, setPendingMessage] = useState<{
    chatId: string;
    message: OutgoingUserMessage;
  } | null>(null);
  /** Just-created chats, held until the agent's state broadcast catches up. */
  const [optimisticChats, setOptimisticChats] = useState<ChatSummary[]>([]);

  // The chat list lives in the OrgAgent's broadcast state (upstream directory
  // pattern): create/rename/delete/touch all re-broadcast, so this stays live
  // across tabs without per-client re-fetching.
  const orgAgent = useAgent<OrgAgent, OrgAgentState>({
    agent: "OrgAgent",
    name: organizationId,
    onMessage: (event) => {
      // The OrgAgent broadcasts `{ type: "workspace-change", event }` whenever a
      // file is created/updated/deleted (see OrgAgent.broadcastWorkspaceChange).
      // Invalidate the org's workspace queries so open file viewers refetch.
      // Ignore anything that isn't our JSON signal (the agent framework sends
      // other frames too).
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "workspace-change") {
          queryClient.invalidateQueries({
            queryKey: workspaceQueryKey(organizationId),
          });
        }
      } catch {
        // Non-JSON frame — not a workspace-change signal.
      }
    },
  });

  const chatsLoadState = deriveChatsLoadState(
    orgAgent.connectionError,
    orgAgent.state
  );
  const chats = useMemo(() => {
    const stateChats = Array.isArray(orgAgent.state?.chats)
      ? orgAgent.state.chats
      : [];
    if (optimisticChats.length === 0) {
      return stateChats;
    }
    // Trust the createChat response: include a just-created chat until the
    // next state broadcast contains it (then the optimistic entry drops out).
    const known = new Set(stateChats.map((chat) => chat.id));
    const missing = optimisticChats.filter((chat) => !known.has(chat.id));
    return [...missing, ...stateChats].sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }, [optimisticChats, orgAgent.state]);

  const createChat = useCallback(
    async (opts?: { title?: string }) => {
      // Trust the create response: hold the chat locally so the route check
      // accepts the immediate navigation before the state broadcast lands.
      const chat = await orgAgent.stub.createChat(opts);
      setOptimisticChats((prev) => [...prev, chat]);
      return chat;
    },
    [orgAgent]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await orgAgent.stub.deleteChat(chatId);
        // A just-created chat may exist only as an optimistic entry (its
        // broadcast never landed) — drop it so no ghost row survives.
        setOptimisticChats((prev) => prev.filter((chat) => chat.id !== chatId));
      } catch (error) {
        console.error("[OrgConnection] failed to delete chat", error);
        toast.error("Couldn't delete chat. Please try again.");
        throw error;
      }
    },
    [orgAgent]
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      try {
        await orgAgent.stub.renameChat(chatId, title);
      } catch (error) {
        console.error("[OrgConnection] failed to rename chat", error);
        toast.error("Couldn't rename chat. Please try again.");
        throw error;
      }
    },
    [orgAgent]
  );

  /**
   * Sidebar Retry after a terminal close. `call()` can't help here — it
   * rejects on a closed socket, and partysocket never reopens a terminal
   * close on its own; `reconnect()` forces a fresh connection, after which
   * identity + state re-arrive and the derived load state recovers.
   */
  const retryConnection = useCallback(() => {
    orgAgent.reconnect();
  }, [orgAgent]);

  const searchChats = useCallback(
    (query: string) => orgAgent.stub.searchChats(query),
    [orgAgent]
  );

  const listWorkspace = useCallback(
    (path = "/"): Promise<WorkspaceFileInfo[]> =>
      orgAgent.stub.listWorkspace(path),
    [orgAgent]
  );

  const readWorkspaceFile = useCallback(
    (path: string): Promise<string | null> =>
      orgAgent.stub.readWorkspaceFile(path),
    [orgAgent]
  );

  const value = useMemo<OrgConnectionValue>(
    () => ({
      chats,
      chatsLoadState,
      clearPendingMessage: () => setPendingMessage(null),
      createChat,
      deleteChat,
      listWorkspace,
      organizationId,
      pendingMessage,
      readWorkspaceFile,
      renameChat,
      retryConnection,
      searchChats,
      setPendingMessage: (chatId, message) =>
        setPendingMessage({ chatId, message }),
    }),
    [
      chats,
      chatsLoadState,
      createChat,
      deleteChat,
      listWorkspace,
      organizationId,
      pendingMessage,
      readWorkspaceFile,
      renameChat,
      retryConnection,
      searchChats,
    ]
  );
  return (
    <OrgConnectionContext.Provider value={value}>
      {children}
    </OrgConnectionContext.Provider>
  );
}
