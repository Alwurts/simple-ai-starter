"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { authClient } from "@workspace/auth/client";

export const getInvitationKey = (id: string) => ["invitation", id];
export const getUserInvitationsKey = () => ["user-invitations"] as const;

export const useActiveOrganizationId = () => {
  const { data: session } = authClient.useSession();
  return session?.session?.activeOrganizationId;
};

export const useInvitation = (id: string) =>
  useQuery({
    queryKey: getInvitationKey(id),
    queryFn: async () => {
      // Server-side checks (recipient, pending, expiry) come from
      // better-auth's endpoint — no app-side invitation lookup.
      const res = await authClient.organization.getInvitation({
        query: { id },
      });
      if (res.error) {
        throw new Error(
          res.error.message ?? "Invitation not found or not yours"
        );
      }
      return res.data;
    },
    enabled: !!id,
  });

/**
 * The signed-in user's pending invitations (better-auth
 * `list-user-invitations`); onboarding offers them above "create an
 * organization". Not org data — user-scoped key.
 */
export const useUserInvitations = () =>
  useQuery({
    queryKey: getUserInvitationsKey(),
    queryFn: async () => {
      const res = await authClient.organization.listUserInvitations();
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to load invitations");
      }
      return res.data ?? [];
    },
  });

// Mutations touch Better Auth state only: its nanostore hooks
// (useSession/useListOrganizations/useActiveOrganization/…) refresh
// themselves, so there is nothing to invalidate in React Query here.

export const useAcceptInvitation = () =>
  useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to accept invitation");
      }
      return res.data;
    },
  });

export const useRejectInvitation = () =>
  useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.rejectInvitation({
        invitationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to reject invitation");
      }
      return res.data;
    },
  });

export const useInviteMember = () =>
  useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email: string;
      role: "member" | "admin" | "owner";
    }) => {
      const res = await authClient.organization.inviteMember({
        email,
        role,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to invite member");
      }
      return res.data;
    },
  });

export const useRemoveMember = () =>
  useMutation({
    mutationFn: async ({ memberIdOrEmail }: { memberIdOrEmail: string }) => {
      const res = await authClient.organization.removeMember({
        memberIdOrEmail,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to remove member");
      }
      return res.data;
    },
  });

export const useCancelInvitation = () =>
  useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await authClient.organization.cancelInvitation({
        invitationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to cancel invitation");
      }
      return res.data;
    },
  });

export const useDeleteOrganization = () =>
  useMutation({
    mutationFn: async (organizationId: string) => {
      const res = await authClient.organization.delete({
        organizationId,
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to delete organization");
      }
      return res.data;
    },
  });

export const useUpdateOrganization = () =>
  useMutation({
    mutationFn: async ({
      name,
      slug,
      logo,
    }: {
      name?: string;
      slug?: string;
      logo?: string;
    }) => {
      const res = await authClient.organization.update({
        data: { name, slug, logo },
      });
      if (res.error) {
        throw new Error(res.error.message ?? "Failed to update organization");
      }
      return res.data;
    },
  });
