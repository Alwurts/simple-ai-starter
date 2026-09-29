import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { useOrgConnection } from "@/features/assistant/connection/org-connection";

export const Route = createFileRoute("/_protected/")({
  component: ChatHomeRedirect,
});

/**
 * The chat is the signed-in home. `/` opens the most recent chat — or the
 * new-chat draft when the org has none — so a thread always lives at its
 * linkable `/chat/$chatId` URL.
 */
function ChatHomeRedirect() {
  const { chats, chatsLoadState } = useOrgConnection();
  const navigate = useNavigate();

  // biome-ignore lint/plugin/no-use-effect: redirect to the most recent chat once the list loads
  useEffect(() => {
    if (chatsLoadState !== "ready") {
      return;
    }
    const latest = chats[0]?.id;
    navigate({
      params: { chatId: latest ?? "new" },
      replace: true,
      to: "/chat/$chatId",
    });
  }, [chats, chatsLoadState, navigate]);

  return (
    <div
      className="flex h-full items-center justify-center"
      data-slot="chat-home-loading"
    >
      <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}
