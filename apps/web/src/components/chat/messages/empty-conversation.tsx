"use client";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/shadcn/empty";
import { MessageCircleDashedIcon } from "lucide-react";

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
