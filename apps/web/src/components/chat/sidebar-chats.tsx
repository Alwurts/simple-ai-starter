"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/shadcn/dropdown-menu";
import {
  SidebarGroup,
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
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { ChatDeleteDialog } from "@/components/chat/chat-delete-dialog";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();

  const onDelete = async (chatId: string) => {
    // This tab leaves the chat route before the delete RPC. A late
    // re-register is ignored; chat_meta is the record.
    if (pathname === `/chat/${chatId}`) {
      closeOnNavigate();
      await navigate({ to: "/chat/new" });
    }
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
      <SidebarGroupContent>
        <SidebarMenu>
          <ChatListGroupRows
            chats={chats}
            chatsLoadState={chatsLoadState}
            closeOnNavigate={closeOnNavigate}
            onDelete={onDelete}
            onRename={renameChat}
            onRetry={onRetry}
            pathname={pathname}
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
  onDelete,
  onRename,
  onRetry,
  pathname,
}: {
  chats: ReturnType<typeof useOrgConnection>["chats"];
  chatsLoadState: ReturnType<typeof useOrgConnection>["chatsLoadState"];
  closeOnNavigate: () => void;
  onDelete: (chatId: string) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
  onRetry: () => void;
  pathname: string;
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
          isActive={pathname === `/chat/${chat.id}`}
          key={chat.id}
          onDelete={onDelete}
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
  onRename,
}: {
  chat: ReturnType<typeof useOrgConnection>["chats"][number];
  closeOnNavigate: () => void;
  isActive: boolean;
  onDelete: (chatId: string) => void;
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
            onClick={closeOnNavigate}
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
