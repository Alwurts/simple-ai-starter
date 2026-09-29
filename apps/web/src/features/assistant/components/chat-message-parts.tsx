"use client";

import type { PendingAction, ProxyToolOutput } from "@cloudflare/codemode";
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
  getToolName,
  isTextUIPart,
  isToolUIPart,
  type ToolUIPart,
  type UIMessagePart,
  type UITools,
} from "ai";
import {
  CheckIcon,
  CircleIcon,
  CopyIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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
 * Parts that stay inside the collapsed Worked group. A pending approval, a
 * paused codemode run, and a finished `display_product_list` card stay in the
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
 * this paused output). The transcript's `pending` array is a truncated
 * preview, so the authoritative args are re-fetched via `pendingExecutions`
 * and the Approve button stays disabled until they are loaded.
 */
function PausedExecutionCard({
  code,
  output,
  onLoadPendingExecution,
  onExecutionApproval,
}: {
  code: string;
  output: Extract<ExecuteToolOutput, { status: "paused" }>;
  onLoadPendingExecution?:
    | ((executionId: string) => Promise<PendingAction[]>)
    | undefined;
  onExecutionApproval?:
    | ((executionId: string, approved: boolean) => void)
    | undefined;
}) {
  const [pending, setPending] = useState<PendingAction[]>(output.pending);
  const [pendingLoaded, setPendingLoaded] = useState(
    () => !onLoadPendingExecution
  );
  const [loadError, setLoadError] = useState(false);
  const loaded = pendingLoaded && !loadError;

  // biome-ignore lint/plugin/no-use-effect: fetch the authoritative pending args once per paused execution
  useEffect(() => {
    if (!onLoadPendingExecution) {
      return;
    }
    let cancelled = false;
    setLoadError(false);
    onLoadPendingExecution(output.executionId)
      .then((actions) => {
        if (cancelled) {
          return;
        }
        if (actions.length > 0) {
          setPending(actions);
        }
        setPendingLoaded(true);
      })
      .catch((error: unknown) => {
        console.error("[chat] pendingExecutions failed", error);
        if (!cancelled) {
          setLoadError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [onLoadPendingExecution, output.executionId]);

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
        {pending.map((call) => (
          <div
            className="flex flex-col gap-0.5 rounded-md border px-3 py-2 text-xs"
            key={`${call.connector}-${call.method}-${call.seq ?? 0}`}
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
        {loadError ? (
          <p className="text-destructive text-xs">
            Couldn't load the full pending action args. Retry by reopening.
          </p>
        ) : null}
        <div className="flex gap-2 py-1">
          <Button
            disabled={!loaded}
            onClick={() => onExecutionApproval?.(output.executionId, true)}
            size="xs"
            type="button"
          >
            <PlayIcon />
            Approve
          </Button>
          <Button
            disabled={!loaded}
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

  if (part.state === "approval-requested") {
    return (
      <div className="flex flex-col gap-2">
        {code ? <CodeBlock code={code} /> : null}
        <p className="text-muted-foreground text-xs">
          This will run the code in a sandbox. Approve to continue.
        </p>
      </div>
    );
  }

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
}: {
  part: DynamicToolUIPart | ToolUIPart;
  messageId: string;
  partIndex: number;
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
}) {
  if (isProductListCardPart(part)) {
    return <ProductListCard output={part.output} />;
  }
  if (getToolName(part) === EXECUTE_TOOL_NAME) {
    const paused = executeOutputOf(part);
    if (paused?.status === "paused") {
      return (
        <PausedExecutionCard
          code={inputCodeOf(part)}
          onLoadPendingExecution={onLoadPendingExecution}
          onExecutionApproval={onExecutionApproval}
          output={paused}
        />
      );
    }
    return (
      <Tool
        defaultOpen={part.state === "approval-requested"}
        key={`${messageId}-tool-${partIndex}`}
      >
        <ToolHeader
          input={part.input}
          state={part.state}
          title="execute"
          type="tool-execute"
        />
        <ToolContent>
          <ExecuteToolBody part={part} />
          {part.state === "approval-requested" &&
          part.approval?.id &&
          onToolApproval ? (
            <div className="flex gap-2 py-1">
              <Button
                onClick={() => onToolApproval(part.approval?.id ?? "", true)}
                size="xs"
                type="button"
              >
                Approve
              </Button>
              <Button
                onClick={() => onToolApproval(part.approval?.id ?? "", false)}
                size="xs"
                type="button"
                variant="outline"
              >
                Reject
              </Button>
            </div>
          ) : null}
        </ToolContent>
      </Tool>
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
}: {
  part: UIMessagePart<AIDataPart, UITools>;
  messageId: string;
  partIndex: number;
  isLastPart: boolean;
  isStreaming: boolean;
  role: OrgChatMessage["role"];
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
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
  onExecutionApproval,
  onLoadPendingExecution,
  onRegenerate,
}: {
  message: OrgChatMessage;
  isStreaming?: boolean;
  onToolApproval?: (id: string, approved: boolean) => void;
  onExecutionApproval?: (executionId: string, approved: boolean) => void;
  onLoadPendingExecution?: (executionId: string) => Promise<PendingAction[]>;
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
      onExecutionApproval={onExecutionApproval}
      onLoadPendingExecution={onLoadPendingExecution}
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
