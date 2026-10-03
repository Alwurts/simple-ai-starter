import { createFileRoute } from "@tanstack/react-router";
import { DockRouteSync } from "@/components/chat/dock/chat-dock";

export const Route = createFileRoute("/_protected/_org/chat/new")({
  component: NewChatRoute,
});

function NewChatRoute() {
  return <DockRouteSync chatId={null} />;
}
