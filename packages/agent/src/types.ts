import type { UIMessage } from "ai";
import type { WORKSPACE_CHANGE_FRAME } from "./constants";

/** The chat message as `OrgChat` writes it and the web UI reads it. */
export type OrgChatUIMessage = UIMessage;

export interface ChatSummary {
  createdAt: number;
  id: string;
  title: string;
  updatedAt: number;
}

/**
 * One entry in the org workspace as the browser sees it. Symlinks are listed
 * as files.
 */
export interface WorkspaceFileInfo {
  /** Absolute path, always under `WORKSPACE_ROOT`. */
  path: string;
  name: string;
  type: "file" | "directory";
}

export interface WorkspaceChangeFrame {
  type: typeof WORKSPACE_CHANGE_FRAME;
}

export interface OrgMemorySnapshot {
  content: string | null;
  updatedAt: number | null;
}

/**
 * One FTS hit inside a single chat's transcript (`OrgChat.searchMessages`).
 * Chat identity (id + title) is stamped by `OrgAgent.searchChats`, which fans
 * the query out to each registered chat. Sessions' `search()` projects only
 * id/role/content — there is no per-hit timestamp to surface.
 */
export interface ChatMessageHit {
  messageId: string;
  role: string;
  snippet: string;
}

/** A search hit attributed to the chat that contains it (sidebar results). */
export interface ChatSearchHit extends ChatMessageHit {
  chatId: string;
  chatTitle: string;
}

/** Agent state broadcast to every connected client (upstream directory pattern). */
export interface OrgAgentState {
  /** Ordered chat list, most-recently-active first. */
  chats: ChatSummary[];
}

export interface AgentToolsContext {
  organizationId: string;
  userId: string;
}
