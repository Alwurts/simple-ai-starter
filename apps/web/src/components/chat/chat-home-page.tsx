import { Navigate } from "@tanstack/react-router";
import { Loader2Icon } from "lucide-react";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { homeRedirectTarget } from "@/lib/chat/home-redirect";

/**
 * The chat is the signed-in home. `/` opens the most recent chat — or the
 * new-chat draft when the org has none — so a thread always lives at its
 * linkable `/chat/$chatId` URL. A failed chat-list load also lands on the
 * draft (a draft needs no list); the sidebar offers Retry for the list.
 * Render-time `<Navigate>` (no effect) so the redirect fires as soon as the
 * target is known.
 */
export function ChatHomePage() {
  const { chats, chatsLoadState } = useOrgConnection();

  const target = homeRedirectTarget(chatsLoadState, chats);
  if (target === null) {
    return (
      <div
        className="flex h-full items-center justify-center"
        data-slot="chat-home-loading"
      >
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (target.kind === "draft") {
    return <Navigate replace to="/chat/new" />;
  }
  return (
    <Navigate params={{ chatId: target.chatId }} replace to="/chat/$chatId" />
  );
}
