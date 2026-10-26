"use client";

import {
  DISPLAY_TOOL_NAMES,
  PERMISSION_DENIED_MESSAGE,
} from "@workspace/agent/constants";
import { Bubble, BubbleContent } from "@workspace/ui/components/shadcn/bubble";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Message,
  MessageContent,
  MessageFooter,
} from "@workspace/ui/components/shadcn/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@workspace/ui/components/shadcn/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@workspace/ui/components/shadcn/tool";
import {
  splitWorkedParts,
  Worked,
  WorkedContent,
  WorkedTrigger,
} from "@workspace/ui/components/shadcn/worked";
import { cn } from "@workspace/ui/lib/utils";
import {
  type DynamicToolUIPart,
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type ToolUIPart,
} from "ai";
import { CopyIcon, RefreshCwIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Streamdown } from "streamdown";
import type { OrgChatMessage } from "@/lib/chat/ai-types";
import { MemoryCard } from "./memory-card";
import { ProductListCard } from "./product-list-card";

function MarkdownBody({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Streamdown
      className={cn(
        "size-full text-base [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
    >
      {children}
    </Streamdown>
  );
}

/**
 * Custom cards: a completed `display_product_list` echo, and a completed
 * `display_memory` echo. An `output-error` part stays on the generic row so
 * `errorText` is visible. Workspace file tools, `set_context`, and `delegate`
 * use the generic row too.
 */
export function isProductListCardPart(
  part: ToolUIPart | DynamicToolUIPart
): boolean {
  return (
    getToolName(part) === DISPLAY_TOOL_NAMES.PRODUCT_LIST &&
    part.state === "output-available"
  );
}

function isVisibleCardName(part: { toolName?: string; type: string }): boolean {
  let name = part.type;
  if (part.toolName) {
    name = part.toolName;
  } else if (part.type.startsWith("tool-")) {
    name = part.type.slice("tool-".length);
  }
  return (
    name === DISPLAY_TOOL_NAMES.PRODUCT_LIST ||
    name === DISPLAY_TOOL_NAMES.MEMORY
  );
}

export function isMemoryCardPart(
  part: ToolUIPart | DynamicToolUIPart
): boolean {
  return (
    getToolName(part) === DISPLAY_TOOL_NAMES.MEMORY &&
    part.state === "output-available"
  );
}

/**
 * Parts that stay inside the collapsed Worked group. A pending approval and a
 * finished product-list or memory card stay in the message flow so the user
 * can act on them without opening the group. After approve/reject the tool
 * is no longer `approval-requested`, so it folds back in.
 */
export function isCollapsedWorkedPart(part: {
  output?: unknown;
  state?: string;
  toolName?: string;
  type: string;
}): boolean {
  if (part.type === "text" || part.type === "step-start") {
    return false;
  }
  if (part.state === "approval-requested") {
    return false;
  }
  if (part.state === "output-available" && isVisibleCardName(part)) {
    return false;
  }
  return true;
}

/**
 * A role-denied write tool throws the RBAC guard's `PERMISSION_DENIED_MESSAGE`,
 * which arrives here as `errorText` on an errored part. We treat that as an
 * expected, benign outcome — a calm "not permitted" note — rather than the red
 * error block a real tool failure gets.
 */
function isPermissionDenied(part: ToolUIPart | DynamicToolUIPart): boolean {
  return (
    part.state === "output-error" &&
    part.errorText === PERMISSION_DENIED_MESSAGE
  );
}

// Base UI ignores a changed `defaultOpen` on an uncontrolled Collapsible.
function ApprovalTool({
  needsApproval,
  children,
}: {
  needsApproval: boolean;
  children: ReactNode;
}) {
  const [userOpen, setUserOpen] = useState(false);
  return (
    <Tool onOpenChange={setUserOpen} open={needsApproval || userOpen}>
      {children}
    </Tool>
  );
}

function DefaultToolPart({
  part,
  messageId,
  partIndex,
  onToolApproval,
}: {
  part: DynamicToolUIPart | ToolUIPart;
  messageId: string;
  partIndex: number;
  onToolApproval?: (id: string, approved: boolean) => void;
}) {
  const toolName = getToolName(part);
  const approvalId =
    part.state === "approval-requested" ? part.approval?.id : undefined;

  return (
    <ApprovalTool
      key={`${messageId}-tool-${partIndex}`}
      needsApproval={part.state === "approval-requested"}
    >
      <ToolHeader
        input={part.input}
        state={part.state}
        title={toolName}
        type={`tool-${toolName}` as ToolUIPart["type"]}
      />
      <ToolContent>
        <ToolInput input={part.input} />
        {approvalId && onToolApproval ? (
          <div className="flex gap-2 py-1">
            <Button
              onClick={() => onToolApproval(approvalId, true)}
              size="xs"
              type="button"
            >
              Approve
            </Button>
            <Button
              onClick={() => onToolApproval(approvalId, false)}
              size="xs"
              type="button"
              variant="outline"
            >
              Reject
            </Button>
          </div>
        ) : null}
        <ToolBody part={part} />
      </ToolContent>
    </ApprovalTool>
  );
}

function ToolBody({ part }: { part: DynamicToolUIPart | ToolUIPart }) {
  const deniedReason =
    part.state === "output-denied" ? part.approval?.reason : undefined;
  if (isPermissionDenied(part)) {
    return <PermissionDeniedNote />;
  }
  if (part.state === "output-denied") {
    return <DeniedNote reason={deniedReason} />;
  }
  return <ToolOutput errorText={part.errorText} output={part.output} />;
}

function PermissionDeniedNote() {
  return (
    <div className="flex items-start gap-2 py-1 text-muted-foreground text-sm">
      <span>
        Your role doesn't allow this action, so it wasn't performed. Ask an
        admin or owner if you need it done.
      </span>
    </div>
  );
}

function DeniedNote({ reason }: { reason?: string }) {
  return (
    <p className="text-destructive text-xs">
      {reason ? `Denied: ${reason}` : "Denied"}
    </p>
  );
}

function ToolPartSwitch({
  part,
  messageId,
  partIndex,
  onToolApproval,
}: {
  part: DynamicToolUIPart | ToolUIPart;
  messageId: string;
  partIndex: number;
  onToolApproval?: (id: string, approved: boolean) => void;
}) {
  if (isProductListCardPart(part)) {
    return <ProductListCard output={part.output} />;
  }
  if (isMemoryCardPart(part)) {
    return <MemoryCard output={part.output} />;
  }
  return (
    <DefaultToolPart
      messageId={messageId}
      onToolApproval={onToolApproval}
      part={part}
      partIndex={partIndex}
    />
  );
}

function OrgMessagePart({
  part,
  messageId,
  partIndex,
  isLastPart,
  isStreaming,
  role,
  onToolApproval,
}: {
  part: OrgChatMessage["parts"][number];
  messageId: string;
  partIndex: number;
  isLastPart: boolean;
  isStreaming: boolean;
  role: OrgChatMessage["role"];
  onToolApproval?: (id: string, approved: boolean) => void;
}) {
  if (part.type === "text") {
    if (role === "user") {
      return (
        <Bubble align="end" variant="secondary">
          <BubbleContent>
            <MarkdownBody>{part.text}</MarkdownBody>
          </BubbleContent>
        </Bubble>
      );
    }

    return (
      <Bubble variant="ghost">
        <BubbleContent className="w-full max-w-full">
          <MarkdownBody>{part.text}</MarkdownBody>
        </BubbleContent>
      </Bubble>
    );
  }

  if (part.type === "reasoning") {
    return (
      <Reasoning
        className="my-2"
        isStreaming={isStreaming && isLastPart}
        key={`${messageId}-reasoning-${partIndex}`}
      >
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  if (isToolUIPart(part)) {
    return (
      <ToolPartSwitch
        key={`${messageId}-tool-${partIndex}`}
        messageId={messageId}
        onToolApproval={onToolApproval}
        part={part}
        partIndex={partIndex}
      />
    );
  }

  return null;
}

export function ChatMessageRow({
  message,
  isStreaming = false,
  onToolApproval,
  onRegenerate,
}: {
  message: OrgChatMessage;
  isStreaming?: boolean;
  onToolApproval?: (id: string, approved: boolean) => void;
  onRegenerate?: (messageId: string) => void;
}) {
  const textForCopy = message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n\n");
  const align = message.role === "user" ? "end" : "start";
  const lastPartIndex = message.parts.length - 1;

  const partRow = (
    part: OrgChatMessage["parts"][number],
    partIndex: number
  ) => (
    <OrgMessagePart
      isLastPart={partIndex === lastPartIndex}
      isStreaming={isStreaming}
      key={`${message.id}-part-${partIndex}`}
      messageId={message.id}
      onToolApproval={onToolApproval}
      part={part}
      partIndex={partIndex}
      role={message.role}
    />
  );

  return (
    <Message align={align}>
      <MessageContent>
        {message.role === "assistant"
          ? splitWorkedParts(message.parts, isCollapsedWorkedPart).map(
              (segment) => {
                if (segment.kind === "worked") {
                  const start = segment.items[0]?.index ?? 0;
                  return (
                    <Worked
                      isStreaming={isStreaming}
                      key={`${message.id}-worked-${start}`}
                    >
                      <WorkedTrigger />
                      <WorkedContent>
                        {segment.items.map((item) =>
                          partRow(item.part, item.index)
                        )}
                      </WorkedContent>
                    </Worked>
                  );
                }
                return partRow(segment.item.part, segment.item.index);
              }
            )
          : message.parts.map((part, partIndex) => partRow(part, partIndex))}
        {message.role === "assistant" && (textForCopy || onRegenerate) ? (
          <MessageFooter>
            <div className="flex items-center gap-1">
              {textForCopy ? (
                <Button
                  aria-label="Copy"
                  onClick={() => navigator.clipboard.writeText(textForCopy)}
                  size="icon-xs"
                  title="Copy"
                  type="button"
                  variant="ghost"
                >
                  <CopyIcon className="size-3.5" />
                </Button>
              ) : null}
              {onRegenerate ? (
                <Button
                  aria-label="Regenerate"
                  disabled={isStreaming}
                  onClick={() => onRegenerate(message.id)}
                  size="icon-xs"
                  title="Regenerate"
                  type="button"
                  variant="ghost"
                >
                  <RefreshCwIcon className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </MessageFooter>
        ) : null}
      </MessageContent>
    </Message>
  );
}
