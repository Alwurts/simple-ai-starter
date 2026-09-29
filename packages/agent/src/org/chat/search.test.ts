import { describe, expect, it } from "vitest";
import type { ChatSummary } from "../../types";
import {
  mergeChatSearchResults,
  SEARCH_MAX_RESULTS,
  snippetAround,
} from "./search";

describe("snippetAround", () => {
  it("centres the window on the match, case-insensitively", () => {
    const snippet = snippetAround(
      "The deployment failed because the token expired.",
      "TOKEN"
    );
    expect(snippet).toContain("token expired");
  });

  it("marks cut sides with ellipses", () => {
    const content = `${"x".repeat(200)} needle ${"y".repeat(200)}`;
    const snippet = snippetAround(content, "needle", 10);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("needle");
  });

  it("falls back to the head of the content when the query is absent", () => {
    const snippet = snippetAround("abcdef", "zzz", 2);
    expect(snippet).toBe("abcd");
  });
});

describe("mergeChatSearchResults", () => {
  const chats: ChatSummary[] = [
    { id: "b", title: "Beta", createdAt: 1, updatedAt: 2 },
    { id: "a", title: "Alpha", createdAt: 1, updatedAt: 1 },
  ];

  it("stamps chat identity and sorts newest-first across chats", () => {
    const hits = mergeChatSearchResults(
      chats,
      new Map([
        [
          "b",
          [
            {
              messageId: "m2",
              role: "user",
              snippet: "beta hit",
              createdAt: "2026-09-28T10:00:00Z",
            },
          ],
        ],
        [
          "a",
          [
            {
              messageId: "m1",
              role: "assistant",
              snippet: "alpha hit",
              createdAt: "2026-09-28T12:00:00Z",
            },
          ],
        ],
      ])
    );
    expect(hits.map((hit) => hit.messageId)).toEqual(["m1", "m2"]);
    expect(hits[0]).toMatchObject({ chatId: "a", chatTitle: "Alpha" });
    expect(hits[1]).toMatchObject({ chatId: "b", chatTitle: "Beta" });
  });

  it("skips chats with no hits or missing entries, and caps the total", () => {
    const many = Array.from({ length: SEARCH_MAX_RESULTS + 10 }, (_, i) => ({
      messageId: `m${i}`,
      role: "user",
      snippet: "hit",
      createdAt: new Date(1_000_000 + i).toISOString(),
    }));
    const merged = mergeChatSearchResults(chats, new Map([["b", many]]));
    expect(merged).toHaveLength(SEARCH_MAX_RESULTS);
  });

  it("returns an empty list when nothing matched", () => {
    expect(mergeChatSearchResults(chats, new Map())).toEqual([]);
  });
});
