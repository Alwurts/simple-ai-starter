import { createFileRoute } from "@tanstack/react-router";
import { ChatPage } from "@/components/chat/chat-page";

export const Route = createFileRoute("/_protected/_org/chat/$chatId")({
  component: ChatPage,
});
