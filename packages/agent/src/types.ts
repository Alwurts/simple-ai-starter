import type { FileInfo } from "@cloudflare/shell";
import type { UIMessage } from "ai";

/**
 * The chat message as `OrgChat` writes it and the web UI reads it. The only
 * metadata the UI consumes is `responseTime` (the "worked" footer duration).
 */
export interface OrgChatMessageMetadata {
  responseTime?: number;
}

export type OrgChatUIMessage = UIMessage<OrgChatMessageMetadata>;

export interface ChatSummary {
  createdAt: number;
  id: string;
  title: string;
  updatedAt: number;
}

/**
 * A single workspace entry (file or directory) as returned by the read-only
 * workspace RPC. Re-exported from `@cloudflare/shell` so client code can type
 * the file viewer without depending on the shell package directly.
 */
export type WorkspaceFileInfo = FileInfo;

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
