import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useEffect } from "react";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { homeRedirectChatId } from "@/lib/chat/home-redirect";

export const Route = createFileRoute("/_protected/")({
  component: ChatHomeRedirect,
});

/**
 * The chat is the signed-in home. `/` opens the most recent chat — or the
 * new-chat draft when the org has none — so a thread always lives at its
 * linkable `/chat/$chatId` URL. A failed chat-list load also lands on the
 * draft (a draft needs no list); the sidebar offers Retry for the list.
 */
function ChatHomeRedirect() {
  const { chats, chatsLoadState } = useOrgConnection();
  const navigate = useNavigate();

  // biome-ignore lint/plugin/no-use-effect: redirect once the chat list resolves (or fails)
  useEffect(() => {
    const chatId = homeRedirectChatId(chatsLoadState, chats);
    if (chatId === null) {
      return;
    }
    navigate({
      params: { chatId },
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
