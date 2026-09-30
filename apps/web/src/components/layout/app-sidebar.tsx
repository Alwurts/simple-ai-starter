"use client";

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ChatSearchHit } from "@workspace/agent/types";
import { authClient } from "@workspace/auth/client";
import { LogoMark } from "@workspace/ui/components/icons/logo-monochrome";
import { Input } from "@workspace/ui/components/shadcn/input";
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
import {
  Loader2Icon,
  MessageSquarePlusIcon,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { AppSidebarFooter } from "@/components/layout/app-sidebar-footer";
import {
  getPlatformNavigationItems,
  isPlatformNavActive,
} from "@/components/layout/platform-navigation";
import { SearchCommand } from "@/components/search/search-command";

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

/** Org thread list (`OrgAgent.listChats`, newest first) with New chat + delete. */
function AppSidebarChats() {
  const { chats, chatsLoadState, deleteChat, reloadChats, searchChats } =
    useOrgConnection();
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
      await navigate({ to: "/chat/new" });
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
      await navigate(
        next
          ? { params: { chatId: next }, to: "/chat/$chatId" }
          : { to: "/chat/new" }
      );
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
        <ChatSearchBox
          closeOnNavigate={closeOnNavigate}
          searchChats={searchChats}
        />
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

const CHAT_SEARCH_MIN_QUERY = 2;
const CHAT_SEARCH_DEBOUNCE_MS = 300;

/**
 * Conversation search in the Chats group: a debounced query fans out
 * to `OrgAgent.searchChats` (FTS over each chat's transcript) and renders
 * matching chats with a snippet. Clicking a hit opens that chat.
 */
function ChatSearchBox({
  closeOnNavigate,
  searchChats,
}: {
  closeOnNavigate: () => void;
  searchChats: (query: string) => Promise<ChatSearchHit[]>;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [hits, setHits] = useState<ChatSearchHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const debouncedSetQuery = useDebouncedCallback(
    setDebouncedQuery,
    CHAT_SEARCH_DEBOUNCE_MS
  );

  const trimmed = debouncedQuery.trim();
  const active = trimmed.length >= CHAT_SEARCH_MIN_QUERY;

  // biome-ignore lint/plugin/no-use-effect: debounced search RPC on query change
  useEffect(() => {
    if (!active) {
      setStatus("idle");
      setHits([]);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    searchChats(trimmed)
      .then((results) => {
        if (cancelled) {
          return;
        }
        setHits(results);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        console.error("[AppSidebar] chat search failed", error);
        if (!cancelled) {
          setStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, searchChats, trimmed]);

  const clear = () => {
    setQuery("");
    setDebouncedQuery("");
    debouncedSetQuery.cancel();
  };

  const onOpenHit = (hit: ChatSearchHit) => {
    clear();
    closeOnNavigate();
    navigate({ params: { chatId: hit.chatId }, to: "/chat/$chatId" });
  };

  return (
    <div className="mb-1 flex flex-col gap-1 px-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 bg-sidebar pl-7 text-sidebar-foreground"
          onChange={(event) => {
            setQuery(event.target.value);
            debouncedSetQuery(event.target.value);
          }}
          placeholder="Search chats…"
          value={query}
        />
        {query ? (
          <button
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
            onClick={clear}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>
      {status === "loading" ? (
        <span className="flex items-center gap-1.5 px-1 py-0.5 text-muted-foreground text-xs">
          <Loader2Icon className="size-3 animate-spin" />
          Searching…
        </span>
      ) : null}
      {status === "error" ? (
        <span className="px-1 py-0.5 text-destructive text-xs">
          Couldn't search. Try again.
        </span>
      ) : null}
      {status === "ready" && hits.length === 0 ? (
        <span className="flex items-center gap-1.5 px-1 py-0.5 text-muted-foreground text-xs">
          <SearchX className="size-3" />
          No matching messages
        </span>
      ) : null}
      {hits.map((hit) => (
        <button
          className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          key={`${hit.chatId}-${hit.messageId}`}
          onClick={() => onOpenHit(hit)}
          type="button"
        >
          <span className="truncate font-medium text-xs">{hit.chatTitle}</span>
          <span className="line-clamp-2 text-muted-foreground text-xs">
            {hit.snippet}
          </span>
        </button>
      ))}
    </div>
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
