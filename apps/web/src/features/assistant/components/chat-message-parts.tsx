"use client";

import { PERMISSION_DENIED_MESSAGE } from "@workspace/agent/constants";
import type { AIDataPart } from "@workspace/contract/ai";
import { Bubble, BubbleContent } from "@workspace/ui/components/shadcn/bubble";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@workspace/ui/components/shadcn/marker";
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
  isTextUIPart,
  isToolUIPart,
  type ToolUIPart,
  type UIMessagePart,
  type UITools,
} from "ai";
import { CheckIcon, CircleIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { Streamdown } from "streamdown";
import type { OrgChatMessage } from "../lib/ai-types";
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

function PlanPart({
  entries,
  messageId,
  partIndex,
}: {
  entries: AIDataPart["plan"]["entries"];
  messageId: string;
  partIndex: number;
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className="my-2 flex flex-col gap-1"
      key={`${messageId}-plan-${partIndex}`}
    >
      {entries.map((entry, index) => {
        const done = entry.status === "completed";
        return (
          <Marker
            // biome-ignore lint/suspicious/noArrayIndexKey: plan entries have no stable id
            key={`${messageId}-plan-${partIndex}-${index}`}
          >
            <MarkerIcon>{done ? <CheckIcon /> : <CircleIcon />}</MarkerIcon>
            <MarkerContent className={cn(done && "line-through")}>
              {entry.content}
            </MarkerContent>
          </Marker>
        );
      })}
    </div>
  );
}

export const PRODUCT_LIST_TOOL_NAME = "display_product_list";

export function getToolName(part: ToolUIPart | DynamicToolUIPart): string {
  if ("toolName" in part && typeof part.toolName === "string") {
    return part.toolName;
  }
  if (part.type.startsWith("tool-")) {
    return part.type.slice(5);
  }
  return part.type;
}

/**
 * The one custom tool card: a completed `display_product_list` echo renders as
 * a product card; every other tool (incl. `display_memory`, workspace file
 * tools, `set_context`, `delegate`) uses the generic tool row.
 */
export function isProductListCardPart(
  part: ToolUIPart | DynamicToolUIPart
): boolean {
  return (
    getToolName(part) === PRODUCT_LIST_TOOL_NAME &&
    part.state === "output-available"
  );
}

/**
 * Parts that stay inside the collapsed Worked group. A pending approval and a
 * finished `display_product_list` card stay in the message flow so the user
 * can act on them without opening the group. After approve/reject the tool
 * is no longer `approval-requested`, so it folds back in.
 */
export function isCollapsedWorkedPart(part: {
  type: string;
  state?: string;
  toolName?: string;
}): boolean {
  if (part.type === "text" || part.type === "step-start") {
    return false;
  }
  if (part.state === "approval-requested") {
    return false;
  }
  if (
    part.state === "output-available" &&
    (part.toolName === PRODUCT_LIST_TOOL_NAME ||
      part.type === `tool-${PRODUCT_LIST_TOOL_NAME}`)
  ) {
    return false;
  }
  return true;
}

/**
 * A role-denied write tool throws the RBAC guard's `PERMISSION_DENIED_MESSAGE`,
 * which arrives here as `errorText` on an errored part. We treat that as an
 * expected, benign outcome — a calm "not permitted" note — rather than the red
 * error block a real tool failure gets (ALW-401 AC-3).
 */
function isPermissionDenied(part: ToolUIPart | DynamicToolUIPart): boolean {
  return (
    part.state === "output-error" &&
    part.errorText === PERMISSION_DENIED_MESSAGE
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
    <Tool
      defaultOpen={part.state === "approval-requested"}
      key={`${messageId}-tool-${partIndex}`}
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
    </Tool>
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
  part: UIMessagePart<AIDataPart, UITools>;
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

  if (part.type === "dynamic-tool" || isToolUIPart(part)) {
    return (
      <ToolPartSwitch
        key={`${messageId}-tool-${partIndex}`}
        messageId={messageId}
        onToolApproval={onToolApproval}
        part={part as DynamicToolUIPart | ToolUIPart}
        partIndex={partIndex}
      />
    );
  }

  if (part.type === "data-plan") {
    return (
      <PlanPart
        entries={part.data.entries}
        key={`${messageId}-plan-${partIndex}`}
        messageId={messageId}
        partIndex={partIndex}
      />
    );
  }

  return null;
}

function workedDurationSeconds(message: OrgChatMessage): number | undefined {
  const responseTime = message.metadata?.responseTime;
  if (typeof responseTime !== "number" || responseTime <= 0) {
    return;
  }
  return Math.max(1, Math.round(responseTime / 1000));
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
  const duration = workedDurationSeconds(message);

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
                      duration={duration}
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
