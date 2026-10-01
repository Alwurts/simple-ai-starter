"use client";

import { can } from "@workspace/auth/access-control";
import { authClient } from "@workspace/auth/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/shadcn/alert-dialog";
import { Button } from "@workspace/ui/components/shadcn/button";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/shadcn/table";
import { useState } from "react";
import { useCancelInvitation } from "@/hooks/organization/use-organization";
import { INTL_LOCALE } from "@/lib/locale";
import { roleLabel } from "@/lib/organization/role-label";

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date | string;
}

interface InvitationsTableProps {
  invitations: Invitation[];
}

export function InvitationsTable({ invitations }: InvitationsTableProps) {
  const { data: activeMember } = authClient.useActiveMember();
  const canManageMembers = can("member:manage", {
    role: activeMember?.role ?? null,
  });
  const cancelInvitation = useCancelInvitation();
  const [invitationPendingCancel, setInvitationPendingCancel] = useState<
    Invitation | undefined
  >();

  const formatDate = (dateString: Date | string) => {
    const date =
      typeof dateString === "string" ? new Date(dateString) : dateString;
    return date.toLocaleDateString(INTL_LOCALE, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleCancelInvitation = async (invitation: Invitation) => {
    try {
      await cancelInvitation.mutateAsync(invitation.id);
      toast.success("Invitation cancelled");
      setInvitationPendingCancel(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel invitation"
      );
    }
  };

  const onConfirmCancel = () => {
    if (invitationPendingCancel) {
      handleCancelInvitation(invitationPendingCancel);
    }
  };

  if (invitations.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm">
        No pending invitations
      </p>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            {canManageMembers && (
              <TableHead className="text-right">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => (
            <TableRow key={invitation.id}>
              <TableCell>{invitation.email}</TableCell>
              <TableCell>{roleLabel(invitation.role)}</TableCell>
              <TableCell className="capitalize">{invitation.status}</TableCell>
              <TableCell>{formatDate(invitation.expiresAt)}</TableCell>
              {canManageMembers && (
                <TableCell className="text-right">
                  <Button
                    className="h-auto px-2 py-1 text-xs underline hover:no-underline"
                    disabled={cancelInvitation.isPending}
                    onClick={() => setInvitationPendingCancel(invitation)}
                    variant="destructive"
                  >
                    Cancel
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setInvitationPendingCancel(undefined);
          }
        }}
        open={!!invitationPendingCancel}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              {`This will revoke the pending invitation for ${invitationPendingCancel?.email ?? ""}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelInvitation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelInvitation.isPending}
              onClick={onConfirmCancel}
              variant="destructive"
            >
              {cancelInvitation.isPending ? "Cancelling..." : "Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
