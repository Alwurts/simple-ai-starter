"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { isOrgDataQueryKey } from "@/lib/query";

/**
 * Switch the active organization. Org data keys carry the org id
 * (`lib/<feature>/*-queries.ts`); a switch invalidates all of it — the old
 * org's cache must not linger and the new org's stale entries refetch.
 * Better Auth's nanostores (session/orgs/active-org) refresh themselves.
 */
export function useSetActiveOrganization() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refetch: refetchActiveOrganization } =
    authClient.useActiveOrganization();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await authClient.organization.setActive({
        organizationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Couldn't switch organization");
      }
      return res.data;
    },
    onSuccess: () => {
      toast.success("Organization set as active");
      navigate({
        to: "/",
      });
      refetchActiveOrganization();
      queryClient.invalidateQueries({
        predicate: (query) => isOrgDataQueryKey(query.queryKey),
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Couldn't switch organization"
      );
    },
  });
}
