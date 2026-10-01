"use client";

import { useNavigate } from "@tanstack/react-router";
import { AuthPage } from "@workspace/ui/components/brand/auth-page";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/shadcn/card";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { CreateOrganizationForm } from "@/components/organization/create-organization-form";
import {
  useAcceptInvitation,
  useUserInvitations,
} from "@/hooks/organization/use-organization";
import { roleLabel } from "@/lib/organization/role-label";

/**
 * Invitations for a user with no org yet: accepting sets the org active and
 * heads straight into the app — an invited new user never needs to create an
 * organization first.
 */
function PendingInvitations() {
  const { data: invitations, isLoading } = useUserInvitations();
  const acceptInvitation = useAcceptInvitation();
  const navigate = useNavigate();

  if (isLoading || !invitations?.length) {
    return null;
  }
  const pending = invitations.filter(
    (invitation) => invitation.status === "pending"
  );
  if (pending.length === 0) {
    return null;
  }

  const accept = async (invitationId: string) => {
    try {
      await acceptInvitation.mutateAsync(invitationId);
      navigate({ to: "/" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to accept invitation"
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
        <CardDescription>
          You've been invited to join an organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pending.map((invitation) => (
          <div
            className="flex items-center justify-between gap-3"
            key={invitation.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-sm">
                {invitation.organizationName}
              </p>
              <p className="text-muted-foreground text-xs">
                {roleLabel(invitation.role)}
              </p>
            </div>
            <Button
              disabled={acceptInvitation.isPending}
              onClick={() => accept(invitation.id)}
              size="sm"
            >
              Accept
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function OnboardingPage() {
  return (
    <AuthPage>
      <div className="w-full max-w-md space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-bold text-3xl">Welcome</h1>
          <p className="text-lg text-muted-foreground">
            Let's create your organization to get started
          </p>
        </div>

        <PendingInvitations />

        <div className="space-y-6">
          <CreateOrganizationForm className="space-y-6" />
        </div>

        <div className="text-center text-muted-foreground text-sm">
          <p>
            You can invite team members and manage settings after creating your
            organization.
          </p>
        </div>
      </div>
    </AuthPage>
  );
}
