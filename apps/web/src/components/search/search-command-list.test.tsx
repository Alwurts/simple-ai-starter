// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChatSearchHit, ChatSummary } from "@workspace/agent/types";
import { Command, CommandInput } from "@workspace/ui/components/shadcn/command";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { SearchCommandList } from "./search-command-list";

const SNIPPET_HIT = /snippet about invoices/;

function jsdomNoop() {
  // cmdk measures the list and scrolls the highlight; jsdom has neither.
}

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = jsdomNoop;
    unobserve = jsdomNoop;
    disconnect = jsdomNoop;
  };
  Element.prototype.scrollIntoView = jsdomNoop;
});

afterEach(() => {
  cleanup();
});

function chat(id: string, title: string): ChatSummary {
  return { createdAt: 0, id, title, updatedAt: 0 };
}

function hit(
  partial: Pick<ChatSearchHit, "chatId" | "chatTitle" | "messageId" | "snippet">
): ChatSearchHit {
  return { role: "user", ...partial };
}

function renderList({
  query,
  chats,
  messageHits = [],
  onNavigate = () => undefined,
  onNavigateToChat = () => undefined,
}: {
  query: string;
  chats: ChatSummary[];
  messageHits?: ChatSearchHit[];
  onNavigate?: (path: string) => void;
  onNavigateToChat?: (chatId: string) => void;
}) {
  return render(
    <Command>
      <CommandInput value={query} />
      <SearchCommandList
        chats={chats}
        messageHits={messageHits}
        onNavigate={onNavigate}
        onNavigateToChat={onNavigateToChat}
        products={[]}
      />
    </Command>
  );
}

describe("SearchCommandList", () => {
  it("shows a transcript hit when the query matches only the snippet", () => {
    renderList({
      chats: [chat("budget", "Budget review"), chat("other", "Other notes")],
      messageHits: [
        hit({
          chatId: "budget",
          chatTitle: "Budget review",
          messageId: "msg-invoice",
          snippet: "snippet about invoices",
        }),
      ],
      query: "invoice",
    });

    expect(screen.getByRole("option", { name: SNIPPET_HIT })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Other notes" })).toBeNull();
    expect(screen.queryByText("No results found.")).toBeNull();
    expect(screen.getByText("Chats").closest("[hidden]")).toBeNull();
  });

  it("shows the empty state when nothing matches", () => {
    renderList({
      chats: [chat("budget", "Budget review")],
      query: "zzzz-no-such-term",
    });

    expect(screen.getByText("No results found.")).toBeTruthy();
  });

  it("gives same-titled chats distinct values the keyboard can choose", () => {
    const chosen: string[] = [];
    renderList({
      chats: [chat("c1", "Standup"), chat("c2", "Standup")],
      messageHits: [
        hit({
          chatId: "c1",
          chatTitle: "Standup",
          messageId: "m9",
          snippet: "discussed the roadmap",
        }),
      ],
      onNavigateToChat: (chatId) => {
        chosen.push(chatId);
      },
      query: "Standup",
    });

    const values = [
      ...document.querySelectorAll<HTMLElement>("[cmdk-item]"),
    ].map((row) => row.getAttribute("data-value"));
    expect(new Set(values)).toEqual(
      new Set(["Standup c1", "Standup c2", "Standup discussed the roadmap m9"])
    );

    const root = document.querySelector("[cmdk-root]");
    if (!root) {
      throw new Error("cmdk root missing");
    }
    fireEvent.keyDown(root, { key: "Enter" });
    fireEvent.keyDown(root, { key: "ArrowDown" });
    fireEvent.keyDown(root, { key: "Enter" });
    fireEvent.keyDown(root, { key: "ArrowDown" });
    fireEvent.keyDown(root, { key: "Enter" });

    expect(new Set(chosen)).toEqual(new Set(["c1", "c2"]));
    expect(chosen).toHaveLength(3);
  });
});
