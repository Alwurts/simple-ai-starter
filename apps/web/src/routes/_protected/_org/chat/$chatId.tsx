import { createFileRoute } from "@tanstack/react-router";
import { DockRouteSync } from "@/components/chat/dock/chat-dock";

export const Route = createFileRoute("/_protected/_org/chat/$chatId")({
  component: ChatIdRoute,
});

function ChatIdRoute() {
  const { chatId } = Route.useParams();
  return <DockRouteSync chatId={chatId} />;
}
