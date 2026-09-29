import type { ChatMessageHit, ChatSearchHit, ChatSummary } from "../../types";

/**
 * Cross-chat conversation search bounds (D-010). Each chat is its own
 * `OrgChat` with its own Sessions FTS5 index, so search fans out from
 * `OrgAgent` to the N most recent chats and merges. The cap keeps one query
 * from waking every chat DO in a long-lived org.
 */
export const SEARCH_MAX_CHATS = 20;
export const SEARCH_MAX_HITS_PER_CHAT = 5;
export const SEARCH_MAX_RESULTS = 30;

/** Characters of context kept on each side of the match in a snippet. */
export const SEARCH_SNIPPET_RADIUS = 60;

/**
 * A short window of `content` centred on the first case-insensitive
 * occurrence of `query`, with ellipses where text was cut. Pure — shared by
 * `OrgChat.searchMessages` and its tests.
 */
export function snippetAround(
  content: string,
  query: string,
  radius = SEARCH_SNIPPET_RADIUS
): string {
  const at = content.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) {
    return content.slice(0, radius * 2).trim();
  }
  const start = Math.max(0, at - radius);
  const end = Math.min(content.length, at + query.length + radius);
  const body = content.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${body}${end < content.length ? "…" : ""}`;
}

/**
 * Merge per-chat hit lists into one list capped at `maxResults`. Chat identity
 * comes from the registry entry; a chat that failed to search contributes
 * nothing. Order = chat iteration order (already most-recently-active first
 * from `listChats`), since Sessions' search projects no timestamps.
 */
export function mergeChatSearchResults(
  chats: ChatSummary[],
  hitsPerChat: Map<string, ChatMessageHit[]>,
  maxResults = SEARCH_MAX_RESULTS
): ChatSearchHit[] {
  const merged: ChatSearchHit[] = [];
  for (const chat of chats) {
    for (const hit of hitsPerChat.get(chat.id) ?? []) {
      merged.push({
        ...hit,
        chatId: chat.id,
        chatTitle: chat.title,
      });
    }
  }
  return merged.slice(0, maxResults);
}
