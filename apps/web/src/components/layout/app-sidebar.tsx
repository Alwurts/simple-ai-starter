"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { authClient } from "@workspace/auth/client";
import { LogoMark } from "@workspace/ui/components/icons/logo-monochrome";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@workspace/ui/components/shadcn/sidebar";
import { Loader2Icon, MessageSquarePlusIcon, Search, X } from "lucide-react";
import { useRef, useState } from "react";
import { AppSidebarFooter } from "@/components/layout/app-sidebar-footer";
import {
  getPlatformNavigationItems,
  isPlatformNavActive,
} from "@/components/layout/platform-navigation";
import { SearchCommand } from "@/components/search/search-command";
import { useOrgConnection } from "@/features/assistant/connection/org-connection";

export function AppSidebar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: activeOrganization } = authClient.useActiveOrganization();
  const appName = activeOrganization?.name ?? "App";
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LogoMark className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
              <span className="block truncate font-semibold">{appName}</span>
              <span className="block truncate text-muted-foreground text-xs">
                Starter
              </span>
            </div>

            <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton
                className="h-8 w-8"
                onClick={() => setSearchOpen(true)}
                size="sm"
                tooltip="Search"
                variant="default"
              >
                <Search className="size-4" />
                <span className="sr-only">Search</span>
              </SidebarMenuButton>

              <SidebarTrigger
                className="hidden h-8 w-8 md:flex"
                toggleLabel="Toggle Sidebar"
              />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
          <SidebarMenuItem>
            <SidebarTrigger className="h-8 w-8" toggleLabel="Toggle Sidebar" />
          </SidebarMenuItem>
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
        <AppSidebarMainNavigation />
        <AppSidebarChats />
      </SidebarContent>
      <SidebarFooter>
        <AppSidebarFooter />
      </SidebarFooter>

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
export function AppSidebarMainNavigation() {
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

/** Org thread list (`OrgAgent.listChats`, newest first) with New chat + delete. */
export function AppSidebarChats() {
  const { chats, chatsLoadState, deleteChat, reloadChats } = useOrgConnection();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const closeOnNavigate = useCloseMobileSidebarOnNavigate();
  const isCreating = useRef(false);

  const onNewChat = async () => {
    if (isCreating.current) {
      return;
    }
    isCreating.current = true;
    try {
      await navigate({ params: { chatId: "new" }, to: "/chat/$chatId" });
    } finally {
      isCreating.current = false;
    }
  };

  const onDelete = async (chatId: string) => {
    try {
      await deleteChat(chatId);
    } catch {
      return;
    }
    if (pathname === `/chat/${chatId}`) {
      const next = chats.find((chat) => chat.id !== chatId)?.id;
      await navigate({
        params: { chatId: next ?? "new" },
        to: "/chat/$chatId",
      });
    }
  };

  const onRetry = () => {
    reloadChats().catch(() => undefined);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Chats</SidebarGroupLabel>
      <SidebarGroupAction onClick={onNewChat} title="New chat">
        <MessageSquarePlusIcon />
        <span className="sr-only">New chat</span>
      </SidebarGroupAction>
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
