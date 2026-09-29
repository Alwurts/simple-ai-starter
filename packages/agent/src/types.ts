import type { FileInfo } from "@cloudflare/shell";

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

export interface AgentToolsContext {
  organizationId: string;
  userId: string;
  waitUntil: (promise: Promise<unknown>) => void;
}
