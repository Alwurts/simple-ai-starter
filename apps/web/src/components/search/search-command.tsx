"use client";

import { useRouter } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandInput,
} from "@workspace/ui/components/shadcn/command";
import { useCommandPaletteShortcut } from "@workspace/ui/hooks/use-command-palette-shortcut";
import { CornerDownLeft, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { SearchCommandList } from "@/components/search/search-command-list";
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

  return (
    <CommandDialog
      description="Search the org: chats, pages and products"
      onOpenChange={handleOpenChange}
      open={open}
      title="Search"
    >
      <CommandInput
        onValueChange={(value) => {
          setQuery(value);
          debouncedSetQuery(value);
        }}
        placeholder="Search everything…"
        value={query}
      />

      <SearchCommandList
        chats={chats}
        messageHits={messageHits}
        onNavigate={navigateTo}
        onNavigateToChat={navigateToChat}
        products={products}
      />

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
