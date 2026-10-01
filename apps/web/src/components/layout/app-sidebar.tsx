"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/shadcn/sidebar";
import { Loader2Icon, MessageSquarePlusIcon, Search, X } from "lucide-react";
import { useState } from "react";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { AppSidebarFooter } from "@/components/layout/app-sidebar-footer";
import {
  getPlatformNavigationItems,
  isPlatformNavActive,
} from "@/components/layout/platform-navigation";
import { OrgSwitcher } from "@/components/organization/org-switcher";
import { SearchCommand } from "@/components/search/search-command";

export function AppSidebar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <OrgSwitcher />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => setSearchOpen(true)}
              tooltip="Search"
            >
              <Search />
              <span>Search</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link onClick={closeOnNavigate} to="/chat/new" />}
                tooltip="New chat"
                variant="outline"
              >
                <MessageSquarePlusIcon />
                <span>New chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <AppSidebarMainNavigation />
        <AppSidebarChats />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>

      <SidebarRail />
      <SearchCommand open={searchOpen} setOpen={setSearchOpen} />
    </Sidebar>
  );
}
function useCloseMobileSidebarOnNavigate() {
  const { isMobile, setOpenMobile } = useSidebar();
  return () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
}
function AppSidebarMainNavigation() {
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const items = getPlatformNavigationItems();
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = isPlatformNavActive(pathname, item.url);
          return (
            <SidebarMenuItem key={`${item.url}`}>
              <SidebarMenuButton
                isActive={isActive}
                render={<Link onClick={closeOnNavigate} to={item.url} />}
                tooltip={item.title}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * Org thread list (`OrgAgent.listChats`, newest first). Text-only (the rows
 * are titles), so the whole group steps aside in the collapsed icon sidebar.
 */
function AppSidebarChats() {
  const { chats, chatsLoadState, deleteChat, retryConnection } =
    useOrgConnection();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();

  const onDelete = async (chatId: string) => {
    try {
      await deleteChat(chatId);
    } catch {
      return;
    }
    if (pathname === `/chat/${chatId}`) {
      const next = chats.find((chat) => chat.id !== chatId)?.id;
      await navigate(
        next
          ? { params: { chatId: next }, to: "/chat/$chatId" }
          : { to: "/chat/new" }
      );
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
  onRetry,
  pathname,
}: {
  chats: ReturnType<typeof useOrgConnection>["chats"];
  chatsLoadState: ReturnType<typeof useOrgConnection>["chatsLoadState"];
  closeOnNavigate: () => void;
  onDelete: (chatId: string) => void;
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
  return (
    <ChatListRows
      chats={chats}
      closeOnNavigate={closeOnNavigate}
      onDelete={onDelete}
      pathname={pathname}
    />
  );
}

function ChatListRows({
  chats,
  closeOnNavigate,
  onDelete,
  pathname,
}: {
  chats: ReturnType<typeof useOrgConnection>["chats"];
  closeOnNavigate: () => void;
  onDelete: (chatId: string) => void;
  pathname: string;
}) {
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
        <SidebarMenuItem key={chat.id}>
          <SidebarMenuButton
            isActive={pathname === `/chat/${chat.id}`}
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
          <button
            aria-label={`Delete ${chat.title}`}
            className="absolute top-1.5 right-1 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover/menu-item:opacity-100 group-data-[active=true]/menu-item:opacity-100"
            onClick={() => onDelete(chat.id)}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </SidebarMenuItem>
      ))}
    </>
  );
}
