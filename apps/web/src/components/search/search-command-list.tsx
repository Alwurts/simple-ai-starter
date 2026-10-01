"use client";

import type { ChatSearchHit, ChatSummary } from "@workspace/agent/types";
import {
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@workspace/ui/components/shadcn/command";
import { type LucideIcon, MessageSquareTextIcon, Package } from "lucide-react";
import { getPlatformNavigationItems } from "@/components/layout/platform-navigation";

interface SearchCommandProduct {
  description?: string | null;
  id: string;
  name: string;
}

interface SearchCommandListProps {
  chats: ChatSummary[];
  messageHits: ChatSearchHit[];
  onNavigate: (path: string) => void;
  onNavigateToChat: (chatId: string) => void;
  products: SearchCommandProduct[];
}

/**
 * Palette rows. Chats and pages filter in cmdk. Message hits are already
 * filtered by the org search, so they stay mounted when cmdk's own score is
 * zero.
 */
export function SearchCommandList({
  chats,
  messageHits,
  onNavigate,
  onNavigateToChat,
  products,
}: SearchCommandListProps) {
  const pages = getPlatformNavigationItems();
  const showChats = chats.length > 0 || messageHits.length > 0;

  return (
    <CommandList className="max-h-[min(28rem,70vh)]">
      {/*
        cmdk's empty state counts only registered items. A force-mounted hit
        is visible without registering, so leave the empty state out while
        any hit is mounted — otherwise a snippet-only query is a blank list,
        or "No results" sits on top of a visible hit.
      */}
      {messageHits.length === 0 && (
        <CommandEmpty>No results found.</CommandEmpty>
      )}

      {showChats && (
        <CommandGroup
          forceMount={messageHits.length > 0 ? true : undefined}
          heading="Chats"
        >
          {chats.map((chat) => (
            <PaletteRow
              // Group forceMount is inherited. Opt title rows out so a
              // transcript-only query still drops chats whose titles miss.
              forceMount={false}
              icon={MessageSquareTextIcon}
              key={chat.id}
              onSelect={() => onNavigateToChat(chat.id)}
              title={chat.title}
              value={`${chat.title} ${chat.id}`}
            />
          ))}
          {messageHits.map((hit) => (
            <PaletteRow
              description={hit.snippet}
              forceMount
              icon={MessageSquareTextIcon}
              key={`${hit.chatId}-${hit.messageId}`}
              onSelect={() => onNavigateToChat(hit.chatId)}
              title={hit.chatTitle}
              value={`${hit.chatTitle} ${hit.snippet} ${hit.messageId}`}
            />
          ))}
        </CommandGroup>
      )}

      <CommandGroup heading="Pages">
        {pages.map((page) => (
          <PaletteRow
            icon={page.icon}
            key={page.url}
            onSelect={() => onNavigate(page.url)}
            title={page.title}
            value={`${page.title} ${page.url}`}
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
              onSelect={() => onNavigate(`/catalog/${product.id}`)}
              title={product.name}
              value={`${product.name} ${product.description ?? ""} ${product.id}`}
            />
          ))}
        </CommandGroup>
      )}
    </CommandList>
  );
}

function PaletteRow({
  title,
  description,
  icon: Icon,
  value,
  forceMount,
  onSelect,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  value: string;
  /**
   * Message hits are filtered server-side (FTS over the transcripts);
   * cmdk's substring score can zero a row the server already matched.
   * `false` opts a row out of a force-mounted group.
   */
  forceMount?: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      className="px-3 py-2"
      forceMount={forceMount}
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
