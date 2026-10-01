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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/shadcn/avatar";
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
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useRemoveMember } from "@/hooks/organization/use-organization";
import { roleLabel } from "@/lib/organization/role-label";

interface Member {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface MembersTableProps {
  members: Member[];
}

export function MembersTable({ members }: MembersTableProps) {
  const { data: session } = authClient.useSession();
  const { data: activeMember } = authClient.useActiveMember();
  const { data: activeOrganization } = authClient.useActiveOrganization();
  // Removing other members is admin+; you can always leave yourself.
  const canManageMembers = can("member:manage", {
    role: activeMember?.role ?? null,
  });
  const removeMember = useRemoveMember();
  const [removingMemberId, setRemovingMemberId] = useState<
    string | undefined
  >();
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<
    Member | undefined
  >();

  const handleRemoveMember = async (member: Member) => {
    setRemovingMemberId(member.id);
    try {
      await removeMember.mutateAsync({ memberIdOrEmail: member.id });
      toast.success(
        session?.user?.id === member.userId
          ? "You've left the organization"
          : "Member removed successfully"
      );
      setMemberPendingRemoval(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    } finally {
      setRemovingMemberId(undefined);
    }
  };

  const ownerCount = members.filter((item) => item.role === "owner").length;

  const pendingIsCurrentUser =
    memberPendingRemoval && session?.user?.id === memberPendingRemoval.userId;

  const removeConfirmLabel = (() => {
    if (removeMember.isPending) {
      return pendingIsCurrentUser ? "Leaving..." : "Removing...";
    }
    return pendingIsCurrentUser ? "Leave organization" : "Remove member";
  })();

  const onConfirmRemove = () => {
    if (memberPendingRemoval) {
      handleRemoveMember(memberPendingRemoval);
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Avatar</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isCurrentUser = session?.user?.id === member.userId;
            const isLoading = removingMemberId === member.id;
            // Operators can leave, but not remove others (honest-disabled).
            const canAct = isCurrentUser || canManageMembers;
            const isSoleOwner =
              isCurrentUser && member.role === "owner" && ownerCount < 2;
            let actionTitle: string | undefined;
            if (isSoleOwner) {
              actionTitle =
                "You're the only owner. Transfer ownership before leaving.";
            } else if (!canAct) {
              actionTitle = "Only administrators can remove members.";
            }

            return (
              <TableRow key={member.id}>
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user.image ?? undefined} />
                    <AvatarFallback>
                      {member.user.name?.slice(0, 2).toUpperCase() ?? "??"}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell className="font-medium">
                  {member.user.name ?? "Unknown"}
                </TableCell>
                <TableCell>{member.user.email}</TableCell>
                <TableCell>{roleLabel(member.role)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    className="h-auto px-2 py-1 text-xs underline hover:no-underline"
                    disabled={isLoading || !canAct || isSoleOwner}
                    onClick={() => setMemberPendingRemoval(member)}
                    title={actionTitle}
                    variant="destructive"
                  >
                    {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    {!isLoading && isCurrentUser && "Leave"}
                    {!(isLoading || isCurrentUser) && "Remove"}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setMemberPendingRemoval(undefined);
          }
        }}
        open={!!memberPendingRemoval}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingIsCurrentUser
                ? "Leave organization?"
                : `Remove ${memberPendingRemoval?.user.name ?? "this member"}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingIsCurrentUser
                ? `You will lose access to ${activeOrganization?.name ?? ""}. You can rejoin only if another member invites you again.`
                : `This will remove ${memberPendingRemoval?.user.name ?? "this member"} from ${activeOrganization?.name ?? ""}. They will lose access immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMember.isPending}
              onClick={onConfirmRemove}
              variant="destructive"
            >
              {removeConfirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
