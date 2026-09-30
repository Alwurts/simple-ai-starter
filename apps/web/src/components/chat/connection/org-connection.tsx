"use client";

import type {
  ChatSearchHit,
  ChatSummary,
  WorkspaceFileInfo,
} from "@workspace/agent/types";
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
import type { OutgoingUserMessage } from "@/lib/chat/ai-types";
import { deriveChatsLoadState } from "@/lib/chat/chats-load-state";

interface OrgAgentState {
  chats: ChatSummary[];
}

interface OrgConnectionValue {
  /** All chats of the active org, newest first (OrgAgent state order). */
  chats: ChatSummary[];
  chatsLoadState: "loading" | "ready" | "error";
  createChat: (opts?: { title?: string }) => Promise<ChatSummary>;
  deleteChat: (chatId: string) => Promise<void>;
  /** FTS search over the org's chats (`OrgAgent.searchChats`). */
  searchChats: (query: string) => Promise<ChatSearchHit[]>;
  /** Retry fallback: re-run `listChats` RPC (also re-broadcasts state). */
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
  const [chatsLoadState, setChatsLoadState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  /** Just-created chats, held until the agent's state broadcast catches up. */
  const [optimisticChats, setOptimisticChats] = useState<ChatSummary[]>([]);

  // The chat list lives in the OrgAgent's broadcast state (upstream directory
  // pattern): create/rename/delete/touch all re-broadcast, so this stays live
  // across tabs without per-client re-fetching. listChats RPC remains as the
  // retry fallback.
  const orgAgent = useAgent<OrgAgentState>({
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

  // biome-ignore lint/plugin/no-use-effect: derive load state from the socket lifecycle
  useEffect(() => {
    setChatsLoadState(
      deriveChatsLoadState({
        connectionError: orgAgent.connectionError,
        // Identity arrives before the state frame, so readiness waits for
        // state — `ready` with an empty list would redirect `/` to the draft
        // and flash "Chat not found" on real chats.
        stateArrived: orgAgent.state !== undefined,
      })
    );
  }, [orgAgent.connectionError, orgAgent.state]);

  const createChat = useCallback(
    async (opts?: { title?: string }) => {
      const chat = (await orgAgent.call(
        "createChat",
        opts ? [opts] : []
      )) as ChatSummary | null;
      if (!chat) {
        throw new Error("createChat returned no chat");
      }
      // Trust the create response: hold the chat locally so the route check
      // accepts the immediate navigation before the state broadcast lands.
      setOptimisticChats((prev) => [...prev, chat]);
      return chat;
    },
    [orgAgent]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      try {
        await orgAgent.call("deleteChat", [chatId]);
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

  /** Sidebar Retry after a failed load: re-run `listChats` (re-broadcasts). */
  const reloadChats = useCallback(async () => {
    setChatsLoadState("loading");
    try {
      const list = (await orgAgent.call("listChats", [])) as ChatSummary[];
      const safeList = Array.isArray(list) ? list : [];
      setChatsLoadState("ready");
      return safeList;
    } catch (error) {
      console.error("[OrgConnection] failed to reload chats", error);
      setChatsLoadState("error");
      throw error;
    }
  }, [orgAgent]);

  const searchChats = useCallback(
    async (query: string): Promise<ChatSearchHit[]> => {
      await orgAgent.ready;
      const hits = (await orgAgent.call("searchChats", [query])) as
        | ChatSearchHit[]
        | null;
      return Array.isArray(hits) ? hits : [];
    },
    [orgAgent]
  );

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
      searchChats,
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
      searchChats,
      workspaceVersion,
    ]
  );
  return (
    <OrgConnectionContext.Provider value={value}>
      {children}
    </OrgConnectionContext.Provider>
  );
}
