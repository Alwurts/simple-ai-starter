import { createFileRoute } from "@tanstack/react-router";
import { ChatHomePage } from "@/components/chat/chat-home-page";

export const Route = createFileRoute("/_protected/_org/")({
  component: ChatHomePage,
});
