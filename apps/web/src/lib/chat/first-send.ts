import type { FileUIPart } from "ai";
import type { OutgoingUserMessage } from "./ai-types";
import { deriveTitleFromMessage } from "./chat-titles";

/**
 * The draft's first send. Returns null when there is nothing to send, so the
 * page does not call `startChat` for an empty composer — opening `/chat/new`
 * writes nothing. The title is derived here and passed with that call (the
 * starter set the title at creation; it did not call `renameChat` afterwards).
 */
export function firstSendPlan(message: {
  text: string;
  files: FileUIPart[];
}): { outgoing: OutgoingUserMessage; title?: string } | null {
  const text = message.text.trim();
  if (!(text || message.files.length > 0)) {
    return null;
  }
  const outgoing: OutgoingUserMessage = {
    role: "user",
    parts: [
      { type: "text", text: text || "Sent with attachments" },
      ...message.files,
    ],
  };
  return { outgoing, title: deriveTitleFromMessage(outgoing.parts) };
}
