import { createFileRoute } from "@tanstack/react-router";
import { FullScreenChat } from "@/components/chat/full-screen-chat";

export const Route = createFileRoute("/_protected/chat/$chatId")({
  component: ChatRoute,
});

/** `"new"` is the reserved draft id — no connection opens until first send. */
function ChatRoute() {
  const { chatId } = Route.useParams();
  return <FullScreenChat chatId={chatId === "new" ? null : chatId} />;
}
