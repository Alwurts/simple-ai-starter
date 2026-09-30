import { createFileRoute } from "@tanstack/react-router";
import { AcceptInvitationPage } from "@/components/organization/invitation/accept-invitation-page";

export const Route = createFileRoute("/_protected/accept-invitation/$id")({
  component: AcceptInvitationPage,
});
