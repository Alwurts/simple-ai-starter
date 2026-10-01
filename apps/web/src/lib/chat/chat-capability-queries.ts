import { queryOptions } from "@tanstack/react-query";
import type { OrgChatModelCapabilities } from "@workspace/agent/inference";
import { client } from "@/lib/client";

/**
 * Root of the chat capabilities key: `[orgId, "chat", "capabilities"]` —
 * the capabilities describe the *active org's* chat model, so the key is
 * org-scoped.
 */
export const chatCapabilitiesQueryKey = (organizationId: string) =>
  [organizationId, "chat", "capabilities"] as const;

export function chatCapabilitiesQueryOptions(organizationId: string) {
  return queryOptions({
    queryKey: chatCapabilitiesQueryKey(organizationId),
    queryFn: async (): Promise<OrgChatModelCapabilities> => {
      const res = await client.chat.capabilities.$get();
      if (!res.ok) {
        throw new Error("Failed to load chat capabilities");
      }
      return res.json();
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
