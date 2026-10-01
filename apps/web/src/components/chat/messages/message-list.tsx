"use client";

import type { PendingAction } from "@cloudflare/codemode";
import { MessageScrollerItem } from "@workspace/ui/components/shadcn/message-scroller";
import type { OrgChatMessage } from "@/lib/chat/ai-types";
import { ChatMessageRow } from "./chat-message-row";
import { EmptyConversation } from "./empty-conversation";

export function MessageListOrEmpty({
  messages,
  streamingMessageId,
  onRegenerate,
  onToolApproval,
  onExecutionApproval,
  onLoadPendingExecution,
  resolvingExecutions,
}: {
  messages: OrgChatMessage[];
  streamingMessageId: string | null;
  onRegenerate: (messageId: string) => void;
  onToolApproval: (id: string, approved: boolean) => void;
  onExecutionApproval: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution: (executionId: string) => Promise<PendingAction[]>;
  resolvingExecutions: ReadonlySet<string>;
}) {
  if (messages.length === 0) {
    return <EmptyConversation />;
  }
  return (
    <>
      {messages.map((message) => (
        <MessageScrollerItem
          key={message.id}
          messageId={message.id}
          scrollAnchor={message.role === "user"}
        >
          <ChatMessageRow
            isStreaming={streamingMessageId === message.id}
            message={message}
            onExecutionApproval={onExecutionApproval}
            onLoadPendingExecution={onLoadPendingExecution}
            onRegenerate={onRegenerate}
            onToolApproval={onToolApproval}
            resolvingExecutions={resolvingExecutions}
          />
        </MessageScrollerItem>
      ))}
    </>
  );
}
