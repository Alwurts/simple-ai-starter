"use client";

import { useRouter } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/shadcn/command";
import { useCommandPaletteShortcut } from "@workspace/ui/hooks/use-command-palette-shortcut";
import {
  CornerDownLeft,
  Loader2,
  type LucideIcon,
  MessageSquareTextIcon,
  Package,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { getPlatformNavigationItems } from "@/components/layout/platform-navigation";
import { useCatalogSearch } from "@/hooks/catalog/use-catalog-search";
import { useChatSearch } from "@/hooks/chat/use-chat-search";
import { currentPaletteShortcutLabel } from "@/lib/search/command-shortcut";

/** Below this the record searches (messages, products) are noise. */
const MIN_QUERY_LENGTH = 2;

interface SearchCommandProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

/**
 * The one search: ⌘K toggles it, the sidebar search button is the mouse
 * entry. Chats and pages filter client-side in cmdk; message hits and
 * products arrive pre-filtered from the org agent / catalog search once the
 * query is long enough.
 */
export function SearchCommand({ open, setOpen }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 300);

  const trimmedDebounced = debouncedQuery.trim();
  const canSearchRecords = open && trimmedDebounced.length >= MIN_QUERY_LENGTH;

  const { chats } = useOrgConnection();
  const chatSearch = useChatSearch(trimmedDebounced);
  const catalogSearch = useCatalogSearch(trimmedDebounced, canSearchRecords);

  const isSearching =
    canSearchRecords && (chatSearch.isFetching || catalogSearch.isFetching);

  const messageHits = canSearchRecords ? (chatSearch.data ?? []) : [];
  const products = canSearchRecords ? (catalogSearch.data?.data ?? []) : [];

  useCommandPaletteShortcut(useCallback(() => setOpen(!open), [open, setOpen]));

  const resetQuery = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    debouncedSetQuery.cancel();
  }, [debouncedSetQuery]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        resetQuery();
      }
    },
    [resetQuery, setOpen]
  );

  const navigateTo = useCallback(
    (path: string) => {
      setOpen(false);
      resetQuery();
      router.navigate({ to: path });
    },
    [resetQuery, router, setOpen]
  );

  const navigateToChat = useCallback(
    (chatId: string) => {
      setOpen(false);
      resetQuery();
      router.navigate({ params: { chatId }, to: "/chat/$chatId" });
    },
    [resetQuery, router, setOpen]
  );

  const pages = getPlatformNavigationItems();

  return (
    <CommandDialog
      description="Search chats, pages and products"
      onOpenChange={handleOpenChange}
      open={open}
      title="Search"
    >
      <CommandInput
        onValueChange={(value) => {
          setQuery(value);
          debouncedSetQuery(value);
        }}
        placeholder="Search chats, pages, products…"
        value={query}
      />

      <CommandList className="max-h-[min(28rem,70vh)]">
        {messageHits.length === 0 && (
          <CommandEmpty>No results found.</CommandEmpty>
        )}

        {chats.length > 0 && (
          <CommandGroup heading="Chats">
            {chats.map((chat) => (
              <PaletteRow
                icon={MessageSquareTextIcon}
                key={chat.id}
                onSelect={() => navigateToChat(chat.id)}
                title={chat.title}
                value={chat.title}
              />
            ))}
            {messageHits.map((hit) => (
              <PaletteRow
                description={hit.snippet}
                forceMount
                icon={MessageSquareTextIcon}
                key={`${hit.chatId}-${hit.messageId}`}
                onSelect={() => navigateToChat(hit.chatId)}
                title={hit.chatTitle}
                value={hit.chatTitle}
              />
            ))}
          </CommandGroup>
        )}

        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <PaletteRow
              icon={page.icon}
              key={page.url}
              onSelect={() => navigateTo(page.url)}
              title={page.title}
              value={page.title}
            />
          ))}
        </CommandGroup>

        {products.length > 0 && (
          <CommandGroup heading="Products">
            {products.map((product) => (
              <PaletteRow
                description={product.description ?? undefined}
                icon={Package}
                key={product.id}
                onSelect={() => navigateTo(`/catalog/${product.id}`)}
                title={product.name}
                value={`${product.name} ${product.description ?? ""}`}
              />
            ))}
          </CommandGroup>
        )}
      </CommandList>

      <div className="flex h-10 items-center justify-between border-t px-3 text-muted-foreground text-xs">
        <span className="flex items-center gap-1">
          <CornerDownLeft className="size-3" /> Open
        </span>
        <span className="flex items-center gap-2">
          {isSearching && <Loader2 className="size-3 animate-spin" />}
          <span>{currentPaletteShortcutLabel()}</span>
        </span>
      </div>
    </CommandDialog>
  );
}

function PaletteRow({
  title,
  description,
  icon: Icon,
  value,
  forceMount = false,
  onSelect,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  value: string;
  /**
   * Message hits are filtered server-side (FTS over the transcripts);
   * cmdk's substring score can zero a row the server already matched.
   */
  forceMount?: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      className="px-3 py-2"
      forceMount={forceMount || undefined}
      onSelect={onSelect}
      value={value}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate">{title}</span>
        {description ? (
          <span className="truncate text-muted-foreground text-xs">
            {description}
          </span>
        ) : null}
      </div>
    </CommandItem>
  );
}
