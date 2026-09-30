"use client";

import type { PendingAction } from "@cloudflare/codemode";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/shadcn/empty";
import { MessageScrollerItem } from "@workspace/ui/components/shadcn/message-scroller";
import { Skeleton } from "@workspace/ui/components/shadcn/skeleton";
import { MessageCircleDashedIcon } from "lucide-react";
import type { OrgChatMessage } from "@/lib/chat/ai-types";
import { ChatMessageRow } from "./chat-message-row";

export function EmptyConversation() {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleDashedIcon />
        </EmptyMedia>
        <EmptyTitle>How can I help?</EmptyTitle>
        <EmptyDescription>
          Ask about your products, or have the assistant work in the org
          workspace.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

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

export function HydratingSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-slot="chat-hydrating">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
