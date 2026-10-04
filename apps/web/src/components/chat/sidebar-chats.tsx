"use client";

import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/shadcn/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/shadcn/sidebar";
import {
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { ChatDeleteDialog } from "@/components/chat/chat-delete-dialog";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { useChatDock } from "@/components/chat/dock/dock-context";
import { RenameChatDialog } from "@/components/chat/rename-chat-dialog";
import { useCloseMobileSidebarOnNavigate } from "@/hooks/layout/use-close-mobile-sidebar-on-navigate";

/**
 * The org's Chats group (`OrgAgent.listChats`, newest first). Text-only —
 * the rows are titles — so the whole group steps aside in the collapsed
 * icon sidebar. Each row's menu shows on hover, focus, and the active row.
 */
export function SidebarChats() {
  const { chats, chatsLoadState, deleteChat, renameChat, retryConnection } =
    useOrgConnection();
  const dock = useChatDock();
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();

  const onDelete = async (chatId: string) => {
    // Unmount the chat socket and leave its URL before the delete RPC. A
    // late re-register is ignored; chat_meta is the record.
    closeOnNavigate();
    await dock.releaseChat(chatId);
    try {
      await deleteChat(chatId);
    } catch {
      // deleteChat already toasted the failure.
    }
  };

  const onRetry = () => {
    retryConnection();
  };

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupAction
        aria-label="New chat"
        onClick={() => {
          closeOnNavigate();
          dock.openDraft();
        }}
        title="New chat"
      >
        <PlusIcon />
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          <ChatListGroupRows
            chats={chats}
            chatsLoadState={chatsLoadState}
            closeOnNavigate={closeOnNavigate}
            focusedChatId={
              dock.state.focus?.kind === "chat" ? dock.state.focus.chatId : null
            }
            onDelete={onDelete}
            onOpen={(chatId) => {
              dock.openChat(chatId);
            }}
            onRename={renameChat}
            onRetry={onRetry}
          />
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function ChatListGroupRows({
  chats,
  chatsLoadState,
  closeOnNavigate,
  focusedChatId,
  onDelete,
  onOpen,
  onRename,
  onRetry,
}: {
  chats: ReturnType<typeof useOrgConnection>["chats"];
  chatsLoadState: ReturnType<typeof useOrgConnection>["chatsLoadState"];
  closeOnNavigate: () => void;
  focusedChatId: string | null;
  onDelete: (chatId: string) => void;
  onOpen: (chatId: string) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
  onRetry: () => void;
}) {
  if (chatsLoadState === "loading") {
    return (
      <SidebarMenuItem>
        <span className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-sm">
          <Loader2Icon className="size-3.5 animate-spin" />
          Loading…
        </span>
      </SidebarMenuItem>
    );
  }
  if (chatsLoadState === "error") {
    return (
      <SidebarMenuItem>
        <span className="flex flex-col gap-1.5 px-2 py-1.5 text-muted-foreground text-sm">
          Couldn't load chats
          <button
            className="w-fit rounded-md border px-2 py-1 text-foreground text-xs hover:bg-muted"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
        </span>
      </SidebarMenuItem>
    );
  }
  if (chats.length === 0) {
    return (
      <SidebarMenuItem>
        <span className="px-2 py-1.5 text-muted-foreground text-sm">
          No chats yet
        </span>
      </SidebarMenuItem>
    );
  }
  return (
    <>
      {chats.map((chat) => (
        <ChatListRow
          chat={chat}
          closeOnNavigate={closeOnNavigate}
          isActive={focusedChatId === chat.id}
          key={chat.id}
          onDelete={onDelete}
          onOpen={onOpen}
          onRename={onRename}
        />
      ))}
    </>
  );
}

function ChatListRow({
  chat,
  closeOnNavigate,
  isActive,
  onDelete,
  onOpen,
  onRename,
}: {
  chat: ReturnType<typeof useOrgConnection>["chats"][number];
  closeOnNavigate: () => void;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onOpen: (chatId: string) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
}) {
  const { isMobile } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={
          <Link
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey ||
                event.button !== 0
              ) {
                return;
              }
              event.preventDefault();
              closeOnNavigate();
              onOpen(chat.id);
            }}
            params={{ chatId: chat.id }}
            to="/chat/$chatId"
          />
        }
        title={chat.title}
        tooltip={chat.title}
      >
        <span className="truncate">{chat.title}</span>
      </SidebarMenuButton>
      <DropdownMenu onOpenChange={setMenuOpen} open={menuOpen}>
        {/*
          md:opacity-0 from showOnHover beats a peer-data opacity utility
          (equal specificity, and the media rule comes later). :has() on the
          active menu button is specific enough to show the action.
        */}
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              className="group-has-[[data-sidebar=menu-button][data-active]]/menu-item:opacity-100"
              showOnHover
            />
          }
        >
          <MoreHorizontalIcon />
          <span className="sr-only">Chat options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-40"
          side={isMobile ? "bottom" : "right"}
        >
          <DropdownMenuItem onClick={() => setRenameOpen(true)}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            variant="destructive"
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameChatDialog
        chat={chat}
        onOpenChange={setRenameOpen}
        onRename={onRename}
        open={renameOpen}
      />
      <ChatDeleteDialog
        chat={chat}
        onConfirm={() => onDelete(chat.id)}
        onOpenChange={setDeleteOpen}
        open={deleteOpen}
      />
    </SidebarMenuItem>
  );
}
