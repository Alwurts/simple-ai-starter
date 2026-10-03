"use client";

import { ShellFooter } from "@workspace/ui/components/brand/shell";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/shadcn/tooltip";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { cn } from "@workspace/ui/lib/utils";
import { BotIcon, PlusIcon, XIcon } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { ChatPage } from "@/components/chat/chat-page";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { useChatDock } from "@/components/chat/dock/dock-context";
import { HomeStage } from "@/components/chat/dock/home-stage";

const MAX_VISIBLE_TABS = 5;

/**
 * The page stays in the outlet. The window covers only that page.
 * Desktop chat tabs live in `ChatTabFooter`, under the inset card.
 * A phone has no tab bar: the window covers the page.
 */
export function ChatDockStage({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      data-slot="chat-dock-stage"
    >
      {children}
      <DockWindow />
    </div>
  );
}

/** Desktop working set, outside the inset card. Hidden until a chat is open. */
export function ChatTabFooter() {
  const dock = useChatDock();
  const isMobile = useIsMobile();
  if (isMobile || dock.state.openChatIds.length === 0) {
    return null;
  }
  return (
    <ShellFooter className="shrink-0 md:mr-2">
      <ChatTabStrip />
    </ShellFooter>
  );
}

/** Deep link: `/chat/new` and `/chat/$chatId` open the dock and leave Home in the inset. */
export function DockRouteSync({ chatId }: { chatId: string | null }) {
  const dock = useChatDock();
  // biome-ignore lint/plugin/no-use-effect: follow the chat URL into the dock
  useEffect(() => {
    if (chatId) {
      dock.openChat(chatId);
      return;
    }
    dock.openDraft();
  }, [chatId, dock.openChat, dock.openDraft]);
  return <HomeStage />;
}

function DockWindow() {
  const dock = useChatDock();
  const isMobile = useIsMobile();
  const focus = dock.state.focus;
  if (!focus) {
    return null;
  }
  const fullscreen = isMobile || dock.state.size === "fullscreen";
  const chatId = focus.kind === "chat" ? focus.chatId : null;
  return (
    <div
      className={cn(
        "absolute z-30 flex min-h-0 flex-col overflow-hidden bg-background",
        isMobile && "inset-0",
        fullscreen && !isMobile && "inset-0",
        !fullscreen &&
          "right-3 bottom-3 h-[640px] max-h-[calc(100%-1.5rem)] w-[480px] max-w-[calc(100%-1.5rem)] rounded-xl border shadow-2xl"
      )}
      data-slot="chat-dock-window"
      hidden={!dock.state.bodyOpen}
    >
      <ChatPage chatId={chatId} files={fullscreen} />
    </div>
  );
}

/** Desktop working set. Older open chats stay in the sidebar list. */
function ChatTabStrip() {
  const dock = useChatDock();
  const { chats } = useOrgConnection();
  const ids = dock.state.openChatIds;
  const visible =
    ids.length > MAX_VISIBLE_TABS ? ids.slice(-MAX_VISIBLE_TABS) : ids;
  const titleOf = (chatId: string) =>
    chats.find((chat) => chat.id === chatId)?.title ?? "Chat";

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-1 px-2"
      data-slot="chat-tab-strip"
    >
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {visible.map((chatId) => (
          <ChatPill chatId={chatId} key={chatId} title={titleOf(chatId)} />
        ))}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Open a new chat"
              className="size-7 shrink-0"
              onClick={dock.openDraft}
              size="icon"
              type="button"
              variant="ghost"
            />
          }
        >
          <PlusIcon />
        </TooltipTrigger>
        <TooltipContent side="top">New chat</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ChatPill({ chatId, title }: { chatId: string; title: string }) {
  const dock = useChatDock();
  const focused =
    dock.state.focus?.kind === "chat" && dock.state.focus.chatId === chatId;
  return (
    <div
      className={cn(
        "group flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-sm",
        focused
          ? "border-border bg-background text-foreground shadow-sm"
          : "border-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground"
      )}
      data-slot="chat-dock-pill"
    >
      <button
        className="flex min-w-0 items-center gap-1.5"
        onClick={() => {
          if (focused && dock.state.bodyOpen) {
            dock.minimize();
            return;
          }
          dock.openChat(chatId);
        }}
        type="button"
      >
        <BotIcon className="size-3.5 shrink-0" />
        <span className="max-w-[160px] truncate">{title}</span>
      </button>
      <button
        aria-label={`Close ${title}`}
        className="rounded p-0.5 opacity-0 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={() => {
          dock.releaseChat(chatId, "close");
        }}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}
