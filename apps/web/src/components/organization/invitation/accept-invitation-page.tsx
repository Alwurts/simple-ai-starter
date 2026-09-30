import { useParams } from "@tanstack/react-router";
import { AcceptInvitation } from "./accept-invitation";

export function AcceptInvitationPage() {
  const { id } = useParams({
    from: "/_protected/accept-invitation/$id",
  });
  return <AcceptInvitation invitationId={id} />;
}
