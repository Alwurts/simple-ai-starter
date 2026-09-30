"use client";

import { useRouter } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/shadcn/badge";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/shadcn/command";
import {
  CornerDownLeft,
  Loader2,
  type LucideIcon,
  Package,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { getPlatformNavigationItems } from "@/components/layout/platform-navigation";
import { useCatalogSearch } from "@/hooks/catalog/use-catalog-search";

const MIN_QUERY_LENGTH = 2;

interface SearchCommandProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function SearchCommand({ open, setOpen }: SearchCommandProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const debouncedSetQuery = useDebouncedCallback((value: string) => {
    setDebouncedQuery(value);
  }, 300);

  const trimmedDebounced = debouncedQuery.trim();
  const canSearchRecords = open && trimmedDebounced.length >= MIN_QUERY_LENGTH;

  const catalogSearch = useCatalogSearch(trimmedDebounced, canSearchRecords);

  const isSearching = canSearchRecords && catalogSearch.isFetching;

  const pages = useMemo(() => {
    const platformNavigationItems = getPlatformNavigationItems();
    const q = query.trim().toLowerCase();
    if (!q) {
      return platformNavigationItems;
    }
    return platformNavigationItems.filter(
      (page) =>
        page.title.toLowerCase().includes(q) ||
        page.url.toLowerCase().includes(q)
    );
  }, [query]);

  const products = canSearchRecords ? (catalogSearch.data?.data ?? []) : [];

  const hasResults = pages.length > 0 || products.length > 0;

  const onQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      debouncedSetQuery(value);
    },
    [debouncedSetQuery]
  );

  // biome-ignore lint/plugin/no-use-effect: document keydown for ⌘K / Ctrl+K / /
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return;
        }

        e.preventDefault();
        setOpen(!open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

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

  let emptyMessage = `Type at least ${MIN_QUERY_LENGTH} characters to search records…`;
  if (query.trim().length === 0) {
    emptyMessage = "Search pages, products…";
  } else if (isSearching) {
    emptyMessage = "Searching…";
  } else if (!hasResults) {
    emptyMessage = "No results found.";
  }

  return (
    <CommandDialog
      description="Search pages and products"
      onOpenChange={handleOpenChange}
      open={open}
      shouldFilter={false}
      title="Global Search"
    >
      <CommandInput
        onValueChange={onQueryChange}
        placeholder="Search pages, products…"
        value={query}
      />

      <CommandList className="max-h-[min(28rem,70vh)]">
        {!hasResults && <CommandEmpty>{emptyMessage}</CommandEmpty>}

        {pages.length > 0 && (
          <CommandGroup heading="Pages">
            {pages.map((page) => (
              <PaletteItem
                badge="Page"
                icon={page.icon}
                key={page.url}
                onSelect={() => navigateTo(page.url)}
                subtitle={page.url}
                title={page.title}
                value={`page:${page.url}`}
              />
            ))}
          </CommandGroup>
        )}

        {products.length > 0 && (
          <CommandGroup heading="Products">
            {products.map((product) => (
              <PaletteItem
                badge="Product"
                icon={Package}
                key={product.id}
                onSelect={() => navigateTo(`/catalog/${product.id}`)}
                subtitle={product.description || product.name}
                title={product.name}
                value={`product:${product.id}`}
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
          <span>⌘K</span>
        </span>
      </div>
    </CommandDialog>
  );
}

function PaletteItem({
  title,
  subtitle,
  badge,
  icon: Icon,
  value,
  onSelect,
}: {
  title: string;
  subtitle: string;
  badge: string;
  icon: LucideIcon;
  value: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      className="flex items-start gap-3 px-3 py-2.5"
      onSelect={onSelect}
      value={value}
    >
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{title}</span>
          <Badge
            className="h-5 shrink-0 px-1.5 font-medium text-[10px] capitalize"
            variant="outline"
          >
            {badge}
          </Badge>
        </div>
        <span className="truncate text-muted-foreground text-xs">
          {subtitle}
        </span>
      </div>
    </CommandItem>
  );
}
