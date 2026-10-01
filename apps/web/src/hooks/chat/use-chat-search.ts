"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrgConnection } from "@/components/chat/connection/org-connection";

/** Below this the FTS query is noise. */
const CHAT_SEARCH_MIN_QUERY = 2;

/**
 * Org conversation search (`OrgAgent.searchChats`, FTS over each chat's
 * transcript). Keyed by org + trimmed query, so results are cached per query
 * and can never cross an org boundary.
 */
export function useChatSearch(debouncedQuery: string) {
  const { organizationId, searchChats } = useOrgConnection();
  const trimmed = debouncedQuery.trim();
  const active = trimmed.length >= CHAT_SEARCH_MIN_QUERY;
  return useQuery({
    queryKey: [organizationId, "chats", "search", trimmed],
    queryFn: () => searchChats(trimmed),
    enabled: active,
    // Nothing invalidates search results, so cached hits would go stale as
    // chats change — retype the same query and you'd get an old transcript
    // snapshot. Always refetch.
    staleTime: 0,
  });
}
