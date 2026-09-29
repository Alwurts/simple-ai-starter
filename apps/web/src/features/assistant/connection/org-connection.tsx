"use client";

import type { ChatSummary, WorkspaceFileInfo } from "@workspace/agent/types";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { useAgent } from "agents/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { OutgoingUserMessage } from "../lib/ai-types";

interface OrgConnectionValue {
  /** All chats of the active org, newest first (OrgAgent.listChats order). */
  chats: ChatSummary[];
  chatsLoadState: "loading" | "ready" | "error";
  createChat: (opts?: { title?: string }) => Promise<ChatSummary>;
  deleteChat: (chatId: string) => Promise<void>;
  /** Re-run `listChats` (sidebar Retry after a failed load). */
  reloadChats: () => Promise<ChatSummary[]>;
  /** Draft bridged across the draft → createChat → navigate hand-off. */
  pendingMessage: OutgoingUserMessage | null;
  clearPendingMessage: () => void;
  setPendingMessage: (message: OutgoingUserMessage) => void;
  /** Read-only workspace listing for the file viewer (defaults to root). */
  listWorkspace: (path?: string) => Promise<WorkspaceFileInfo[]>;
  organizationId: string;
  /** Read a workspace file's text contents (null when absent/binary). */
  readWorkspaceFile: (path: string) => Promise<string | null>;
  /** Bumps whenever the org workspace changes, so viewers can refetch live. */
  workspaceVersion: number;
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
 * over RPC, while each chat's transcript streams over its own
 * `sub: [OrgChat]` connection (see the chat feature). The socket also carries
 * the `workspace-change` broadcast that keeps workspace viewers live.
 */
export function OrgConnection({
  organizationId,
  children,
}: OrgConnectionProps) {
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  const [pendingMessage, setPendingMessage] =
    useState<OutgoingUserMessage | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoadState, setChatsLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");

  const orgAgent = useAgent({
    agent: "OrgAgent",
    name: organizationId,
    onMessage: (event) => {
      // The OrgAgent broadcasts `{ type: "workspace-change", event }` whenever a
      // file is created/updated/deleted (see OrgAgent.broadcastWorkspaceChange).
      // Bump a version counter so open file viewers refetch. Ignore anything
      // that isn't our JSON signal (the agent framework sends other frames too).
      if (typeof event.data !== "string") {
        return;
      }
      try {
        const parsed = JSON.parse(event.data) as { type?: string };
        if (parsed.type === "workspace-change") {
          setWorkspaceVersion((v) => v + 1);
        }
      } catch {
        // Non-JSON frame — not a workspace-change signal.
      }
    },
  });

  const refreshChats = useCallback(async (): Promise<ChatSummary[]> => {
    const list = (await orgAgent.call("listChats", [])) as ChatSummary[];
    const safeList = Array.isArray(list) ? list : [];
    setChats(safeList);
    setChatsLoadState("ready");
    return safeList;
  }, [orgAgent]);

  // biome-ignore lint/plugin/no-use-effect: initial listChats RPC on orgAgent ready
  useEffect(() => {
    let cancelled = false;
    setChatsLoadState("loading");
    refreshChats().catch((error) => {
      console.error("[OrgConnection] failed to load chats", error);
      if (!cancelled) {
        setChatsLoadState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [refreshChats]);

  const createChat = useCallback(
    async (opts?: { title?: string }) => {
      const chat = (await orgAgent.call(
        "createChat",
        opts ? [opts] : []
      )) as ChatSummary | null;
      if (!chat) {
        throw new Error("createChat returned no chat");
      }
      await refreshChats();
      return chat;
    },
    [orgAgent, refreshChats]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await orgAgent.call("deleteChat", [chatId]);
        await refreshChats();
      } catch (error) {
        console.error("[OrgConnection] failed to delete chat", error);
        toast.error("Couldn't delete chat. Please try again.");
        throw error;
      }
    },
    [orgAgent, refreshChats]
  );

  /** Sidebar Retry after a failed initial load: re-run `listChats`. */
  const reloadChats = useCallback(async () => {
    setChatsLoadState("loading");
    try {
      return await refreshChats();
    } catch (error) {
      console.error("[OrgConnection] failed to reload chats", error);
      setChatsLoadState("error");
      throw error;
    }
  }, [refreshChats]);

  const listWorkspace = useCallback(
    async (path = "/"): Promise<WorkspaceFileInfo[]> => {
      await orgAgent.ready;
      const entries = (await orgAgent.call("listWorkspace", [path])) as
        | WorkspaceFileInfo[]
        | null;
      return Array.isArray(entries) ? entries : [];
    },
    [orgAgent]
  );

  const readWorkspaceFile = useCallback(
    async (path: string): Promise<string | null> => {
      await orgAgent.ready;
      return (await orgAgent.call("readWorkspaceFile", [path])) as
        | string
        | null;
    },
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
      reloadChats,
      setPendingMessage,
      workspaceVersion,
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
      reloadChats,
      workspaceVersion,
    ]
  );
  return (
    <OrgConnectionContext.Provider value={value}>
      {children}
    </OrgConnectionContext.Provider>
  );
}
