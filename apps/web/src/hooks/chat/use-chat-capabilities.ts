"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveOrganizationId } from "@/hooks/organization/use-organization";
import { chatCapabilitiesQueryOptions } from "@/lib/chat/chat-capability-queries";

/**
 * Active org-chat model input capabilities. Used to hide/disable
 * the attach control for text-only models before send.
 */
export function useChatCapabilities() {
  const organizationId = useActiveOrganizationId();
  return useQuery({
    ...chatCapabilitiesQueryOptions(organizationId ?? ""),
    enabled: !!organizationId,
  });
}
