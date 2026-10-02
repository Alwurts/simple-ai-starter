"use client";

import type { PendingAction, ProxyToolOutput } from "@cloudflare/codemode";
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
import {
  CopyIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
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

export const PRODUCT_LIST_TOOL_NAME = "display_product_list";

export const EXECUTE_TOOL_NAME = "execute";

/**
 * The `execute` tool's output. `ProxyToolOutput` is codemode's outcome union;
 * Think adds a fourth `rejected` member when `rejectExecution` settles a run
 * (see `rejectExecution` in think.js — it is not part of codemode's union).
 */
interface RejectedExecutionOutput {
  executionId: string;
  reason?: string;
  status: "rejected";
}

type ExecuteToolOutput = ProxyToolOutput | RejectedExecutionOutput;

function executeOutputOf(part: { output?: unknown }): ExecuteToolOutput | null {
  if (
    part.output &&
    typeof part.output === "object" &&
    "status" in part.output &&
    typeof (part.output as { status: unknown }).status === "string"
  ) {
    return part.output as ExecuteToolOutput;
  }
  return null;
}

/** A paused codemode run waiting on approve/reject (Approve must see full args). */
export function isPausedExecutionPart(part: {
  output?: unknown;
  state?: string;
  toolName?: string;
  type: string;
}): boolean {
  return (
    getToolName(part as DynamicToolUIPart) === EXECUTE_TOOL_NAME &&
    executeOutputOf(part)?.status === "paused"
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
    getToolName(part) === PRODUCT_LIST_TOOL_NAME &&
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
  return name === PRODUCT_LIST_TOOL_NAME || name === DISPLAY_TOOL_NAMES.MEMORY;
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
 * Parts that stay inside the collapsed Worked group. A pending approval, a
 * paused codemode run, and a finished product-list or memory card stay in the
 * message flow so the user can act on them without opening the group. After
 * approve/reject the tool is no longer `approval-requested` / `paused`, so it
 * folds back in.
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
  if (isPausedExecutionPart(part)) {
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

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="overflow-hidden rounded-md border bg-muted/40">
      <MarkdownBody className="px-3 py-2 text-xs [&_pre]:bg-transparent">
        {`\`\`\`ts\n${code}\n\`\`\``}
      </MarkdownBody>
    </div>
  );
}

/**
 * A codemode execution awaiting the user: the run paused on a gated sandbox
 * call and the chat continues only via `approveExecution` /
 * `rejectExecution` (Think resumes the run by replay; the outcome replaces
 * this paused output). Behaviour mirrors the Think reference client's
 * `PausedExecutionCard`: the transcript's `pending` array is a truncated
 * preview, so the authoritative args are re-fetched via `pendingExecutions`;
 * an empty result means the run is no longer pending (stale card), and a load
 * failure keeps Reject usable. The card remounts per pause (keyed by
 * `executionId` + first pending `seq`) so a second pause of the same
 * execution never shows the first pause's args.
 */
function PausedExecutionCard({
  code,
  output,
  onLoadPendingExecution,
  onExecutionApproval,
  resolving = false,
}: {
  code: string;
  output: Extract<ExecuteToolOutput, { status: "paused" }>;
  onLoadPendingExecution?:
    | ((executionId: string) => Promise<PendingAction[]>)
    | undefined;
  onExecutionApproval?:
    | ((executionId: string, approved: boolean) => void)
    | undefined;
  resolving?: boolean;
}) {
  const [full, setFull] = useState<
    | { state: "loading" }
    | { state: "loaded"; actions: PendingAction[] }
    | { state: "unavailable" }
  >({ state: "loading" });

  // biome-ignore lint/plugin/no-use-effect: fetch the authoritative pending args once per paused execution
  useEffect(() => {
    if (!onLoadPendingExecution) {
      setFull({ state: "unavailable" });
      return;
    }
    let cancelled = false;
    setFull({ state: "loading" });
    onLoadPendingExecution(output.executionId)
      .then((actions) => {
        if (cancelled) {
          return;
        }
        // An empty list means the execution is no longer pending — resolved
        // elsewhere, expired, or swept. Treat the card as stale.
        setFull(
          actions.length > 0
            ? { state: "loaded", actions }
            : { state: "unavailable" }
        );
      })
      .catch((error: unknown) => {
        console.error("[chat] pendingExecutions failed", error);
        if (!cancelled) {
          setFull({ state: "unavailable" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onLoadPendingExecution, output.executionId]);

  const actions = full.state === "loaded" ? full.actions : output.pending;

  return (
    <Tool defaultOpen>
      <ToolHeader
        input={output.pending}
        state="approval-requested"
        title="execute — code needs your approval"
        type="tool-execute"
      />
      <ToolContent>
        <CodeBlock code={code} />
        {actions.map((call) => (
          <div
            className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-xs"
            key={`${call.connector}-${call.method}-${call.seq}`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldAlertIcon className="size-3.5" />
              {call.connector}.{call.method}
            </span>
            {call.args == null ? null : (
              <pre className="overflow-x-auto font-mono text-muted-foreground">
                {JSON.stringify(call.args, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {full.state === "loading" ? (
          <p className="text-muted-foreground text-xs">
            Verifying full arguments…
          </p>
        ) : null}
        {full.state === "unavailable" ? (
          <p className="text-destructive text-xs">
            Couldn't load the full arguments — this card may be stale, and the
            preview above may be truncated.
          </p>
        ) : null}
        <div className="flex gap-2 py-1">
          <Button
            disabled={resolving || full.state === "loading"}
            onClick={() => onExecutionApproval?.(output.executionId, true)}
            size="xs"
            type="button"
          >
            <PlayIcon />
            Approve
          </Button>
          <Button
            disabled={resolving}
            onClick={() => onExecutionApproval?.(output.executionId, false)}
            size="xs"
            type="button"
            variant="outline"
          >
            Reject
          </Button>
        </div>
      </ToolContent>
    </Tool>
  );
}

/** Readable rendering of a settled codemode run (code in, result/logs out). */
function ExecuteToolBody({ part }: { part: DynamicToolUIPart | ToolUIPart }) {
  const output = executeOutputOf(part);
  const code = inputCodeOf(part);

  if (!output) {
    return <ToolOutput errorText={part.errorText} output={part.output} />;
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {code ? <CodeBlock code={code} /> : null}
      {"logs" in output && output.logs && output.logs.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground">Logs</p>
          <pre className="overflow-x-auto font-mono">
            {output.logs.join("\n")}
          </pre>
        </div>
      ) : null}
      {output.status === "completed" ? (
        <div className="flex flex-col gap-0.5">
          <p className="text-muted-foreground">Result</p>
          <pre className="overflow-x-auto font-mono">
            {JSON.stringify(output.result, null, 2)}
          </pre>
        </div>
      ) : null}
      {output.status === "error" ? (
        <p className="text-destructive">{output.error}</p>
      ) : null}
      {output.status === "rejected" ? (
        <p className="text-muted-foreground">
          Rejected{output.reason ? `: ${output.reason}` : ""}
        </p>
      ) : null}
    </div>
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
  onExecutionApproval,
  onLoadPendingExecution,
  resolvingExecutions,
}: {
  part: DynamicToolUIPart | ToolUIPart;
  messageId: string;
  partIndex: number;
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
  resolvingExecutions?: ReadonlySet<string>;
}) {
  if (isProductListCardPart(part)) {
    return <ProductListCard output={part.output} />;
  }
  if (isMemoryCardPart(part)) {
    return <MemoryCard output={part.output} />;
  }
  if (getToolName(part) === EXECUTE_TOOL_NAME) {
    const paused = executeOutputOf(part);
    if (paused?.status === "paused") {
      // Key per pause: one execution can pause repeatedly (approve → replay →
      // paused on the NEXT gated call replaces this part under the SAME
      // executionId). Remounting re-runs the authoritative-args fetch instead
      // of showing the previous pause's args.
      return (
        <PausedExecutionCard
          code={inputCodeOf(part)}
          key={`${paused.executionId}-${paused.pending[0]?.seq ?? 0}`}
          onLoadPendingExecution={onLoadPendingExecution}
          onExecutionApproval={onExecutionApproval}
          output={paused}
          resolving={resolvingExecutions?.has(paused.executionId) ?? false}
        />
      );
    }
    return (
      <ApprovalTool
        key={`${messageId}-tool-${partIndex}`}
        needsApproval={part.state === "approval-requested"}
      >
        <ToolHeader
          input={part.input}
          state={part.state}
          title="execute"
          type="tool-execute"
        />
        <ToolContent>
          <ExecuteToolBody part={part} />
        </ToolContent>
      </ApprovalTool>
    );
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

function inputCodeOf(part: { input?: unknown }): string {
  return part.input && typeof part.input === "object" && "code" in part.input
    ? String((part.input as { code: unknown }).code)
    : "";
}

function OrgMessagePart({
  part,
  messageId,
  partIndex,
  isLastPart,
  isStreaming,
  role,
  onToolApproval,
  onExecutionApproval,
  onLoadPendingExecution,
  resolvingExecutions,
}: {
  part: OrgChatMessage["parts"][number];
  messageId: string;
  partIndex: number;
  isLastPart: boolean;
  isStreaming: boolean;
  role: OrgChatMessage["role"];
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
  resolvingExecutions?: ReadonlySet<string>;
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
        onExecutionApproval={onExecutionApproval}
        onLoadPendingExecution={onLoadPendingExecution}
        onToolApproval={onToolApproval}
        part={part}
        partIndex={partIndex}
        resolvingExecutions={resolvingExecutions}
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
  onExecutionApproval,
  onLoadPendingExecution,
  onRegenerate,
  resolvingExecutions,
}: {
  message: OrgChatMessage;
  isStreaming?: boolean;
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
  onRegenerate?: (messageId: string) => void;
  resolvingExecutions?: ReadonlySet<string>;
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
      onExecutionApproval={onExecutionApproval}
      onLoadPendingExecution={onLoadPendingExecution}
      onToolApproval={onToolApproval}
      part={part}
      partIndex={partIndex}
      resolvingExecutions={resolvingExecutions}
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
