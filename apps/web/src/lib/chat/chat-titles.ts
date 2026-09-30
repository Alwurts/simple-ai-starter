/** Title for a brand-new draft row before its first message lands. */
export function defaultNewChatTitle(): string {
  return "New chat";
}

/**
 * Derive a chat title from the first outgoing message — the starter's
 * title-from-first-message behaviour (chat-titles.ts): strip code fences,
 * inline code runs, and collapse whitespace, then clamp to 50 chars.
 */
export function deriveTitleFromMessage(
  parts: Array<{ type: string; text?: string }>
): string | undefined {
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join(" ")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) {
    return;
  }
  return text.length > 50 ? `${text.slice(0, 47).trim()}…` : text;
}
