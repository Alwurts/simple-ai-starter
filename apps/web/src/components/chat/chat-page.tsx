"use client";

import type { PendingAction } from "@cloudflare/codemode";
import { useAgentChat } from "@cloudflare/think/react";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { OrgChat } from "@workspace/agent/org/chat";
import type { ChatSummary } from "@workspace/agent/types";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/shadcn/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/shadcn/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/shadcn/message-scroller";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/shadcn/resizable";
import { Skeleton } from "@workspace/ui/components/shadcn/skeleton";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import { useAgent } from "agents/react";
import { isTextUIPart } from "ai";
import {
  ClipboardCopyIcon,
  MessageCircleDashedIcon,
  MoreHorizontalIcon,
  ShrinkIcon,
  Trash2Icon,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChatHeader } from "@/components/chat/chat-header";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { useAgentToolMutationInvalidation } from "@/hooks/chat/use-agent-tool-mutation-invalidation";
import { useChatSidePanel } from "@/hooks/chat/use-chat-side-panel";
import {
  type OrgChatMessage,
  type OutgoingUserMessage,
  toSendableMessage,
} from "@/lib/chat/ai-types";
import { chatRouteState } from "@/lib/chat/chat-route";
import { defaultNewChatTitle } from "@/lib/chat/chat-titles";
import { firstSendPlan } from "@/lib/chat/first-send";
import { ChatComposer, type PromptMessage } from "./input/chat-composer";
import { EmptyConversation } from "./messages/empty-conversation";
import { MessageListOrEmpty } from "./messages/message-list";
import { TurnErrorBanner } from "./messages/turn-error-banner";
import { ChatSidePanel } from "./side-panel/chat-side-panel";

/** Transcript placeholder while the chat socket hydrates its history. */
function HydratingSkeleton() {
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

function chatTitleOf(chats: ChatSummary[], chatId: string | null): string {
  if (!chatId) {
    return defaultNewChatTitle();
  }
  return chats.find((chat) => chat.id === chatId)?.title ?? "Chat";
}

/** Short, model-facing reason sent with `rejectExecution`. */
const REJECT_REASON = "Denied by the user";

/**
 * The chat page. `/chat/new` is the draft: nothing connects until the first
 * send, which creates the chat via `OrgAgent.createChat` and hands off to
 * `/chat/$chatId` — no empty chats pile up (matches the starter's dock). An
 * unknown chat id never mounts ChatView (no chat socket): the sub-agent 404
 * reaches the browser as a non-terminal close and would reconnect forever,
 * so the missing chat is detected from the org state's chat list once it has
 * loaded (`chatRouteState`).
 */
export function ChatPage() {
  const { chats, chatsLoadState } = useOrgConnection();
  // `/chat/new` has no chatId param — that absence is the draft.
  const { chatId: chatIdParam } = useParams({ strict: false });
  const chatId = chatIdParam ?? null;
  const routeState =
    chatId === null ? "open" : chatRouteState(chatId, chatsLoadState, chats);
  return (
    <div
      className="@container flex h-full min-h-0 flex-col overflow-hidden bg-background"
      data-slot="full-screen-chat"
    >
      <ResizablePanelGroup
        className="min-h-0 flex-1"
        data-slot="full-screen-chat-layout"
        orientation="horizontal"
      >
        {routeState === "not-found" ? <ChatNotFound /> : null}
        {routeState === "open" && chatId === null ? (
          <DraftView title={chatTitleOf(chats, null)} />
        ) : null}
        {routeState === "open" && chatId !== null ? (
          <ChatView
            key={chatId}
            chatId={chatId}
            title={chatTitleOf(chats, chatId)}
          />
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

function ChatNotFound() {
  const navigate = useNavigate();
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleDashedIcon />
        </EmptyMedia>
        <EmptyTitle>Chat not found</EmptyTitle>
        <EmptyDescription>
          This conversation doesn't exist (it may have been deleted from another
          device).
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => navigate({ to: "/chat/new" })} type="button">
          <MessageCircleDashedIcon />
          Start a new chat
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function DraftView({ title }: { title: string }) {
  const { createChat, setPendingMessage } = useOrgConnection();
  const navigate = useNavigate();
  const [draftError, setDraftError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (message: PromptMessage) => {
      const plan = firstSendPlan(message);
      if (!plan) {
        return;
      }
      setDraftError(null);
      try {
        const chat = await createChat(
          plan.title ? { title: plan.title } : undefined
        );
        setPendingMessage(chat.id, plan.outgoing);
        navigate({
          params: { chatId: chat.id },
          replace: true,
          to: "/chat/$chatId",
        });
      } catch (error) {
        console.error("[ChatPage] createChat failed", error);
        setDraftError(
          error instanceof Error && error.message
            ? error.message
            : "Couldn't start the chat. Please try again."
        );
      }
    },
    [createChat, navigate, setPendingMessage]
  );

  return (
    <ChatColumn
      body={<EmptyConversation />}
      footer={
        <>
          {draftError ? (
            <p className="pb-1 text-center text-destructive text-sm">
              {draftError}
            </p>
          ) : null}
          <ChatComposer
            onSubmit={handleSubmit}
            placeholder="Start a new conversation..."
            status="ready"
          />
        </>
      }
      header={
        <ChatHeader
          menu={null}
          panelOpen={false}
          title={title}
          onTogglePanel={undefined}
        />
      }
    />
  );
}

interface ChatViewProps {
  chatId: string;
  title: string;
}

function ChatView({ chatId, title }: ChatViewProps) {
  const {
    chats,
    clearPendingMessage,
    deleteChat,
    organizationId,
    pendingMessage,
  } = useOrgConnection();
  const navigate = useNavigate();
  const sidePanel = useChatSidePanel();

  const chatAgent = useAgent<OrgChat, unknown>({
    agent: "OrgAgent",
    name: organizationId,
    sub: [{ agent: "OrgChat", name: chatId }],
  });

  const helpers = useAgentChat<unknown, OrgChatMessage>({
    agent: chatAgent,
    // `null` disables the hook's HTTP `/get-messages` fetch — Think hydrates the
    // transcript over the WebSocket on connect (`cf_agent_chat_messages`), so an
    // HTTP fetch would be a redundant round-trip. It's also the resume-safe path:
    // the server *withholds* that broadcast while a turn is resuming so it can't
    // clobber the assistant message the client is rebuilding from the resume
    // stream. This matches the Think reference client.
    getInitialMessages: null,
    // Coalesce streaming token updates (matches the Think reference client) so
    // a fast stream doesn't re-render the message list on every delta. Pinned:
    // throttling is default-on since agents 0.22 (at 50ms); we keep the
    // pre-0.22 interval.
    throttle: 100,
    // Approvals continue via the agents hook: `addToolApprovalResponse` sends
    // a `cf_agent_tool_approval` frame with `autoContinue`. The previous chat
    // did not set `sendAutomaticallyWhen` — that would also submit the
    // transcript as a second chat request on top of the approval frame.
  });

  // Invalidate React Query when agent write tools complete.
  useAgentToolMutationInvalidation({ messages: helpers.messages });

  // Flush the draft message bridged from `/` once the socket is identified
  // and the hook is ready to send — but only into the chat it was created
  // for. Identification is part of the guard: a frame buffered on a
  // still-connecting socket would be dropped if the user switches chats
  // before it opens. Deduped by object identity (strict-mode safe).
  const lastSentRef = useRef<OutgoingUserMessage | null>(null);
  const { sendMessage } = helpers;
  const identified = chatAgent.identified;
  // biome-ignore lint/plugin/no-use-effect: flush the bridged draft once the connection is ready
  useEffect(() => {
    if (
      pendingMessage?.chatId !== chatId ||
      !identified ||
      helpers.status !== "ready" ||
      lastSentRef.current === pendingMessage.message
    ) {
      return;
    }
    lastSentRef.current = pendingMessage.message;
    const message = pendingMessage.message;
    clearPendingMessage();
    // Never rejects — failures arrive as the hook's `error`.
    sendMessage(toSendableMessage(message));
  }, [
    chatId,
    identified,
    pendingMessage,
    helpers.status,
    sendMessage,
    clearPendingMessage,
  ]);

  // Server-driven continuations (approve/rejectExecution, resume, another
  // tab's turn) set the hook's server-stream flag without changing `status`,
  // so busy/streaming come from `isStreaming` + `isRecovering`, not `status`.
  const chatBusy = helpers.isStreaming || helpers.isRecovering;

  const handleToolApproval = useCallback(
    (id: string, approved: boolean) =>
      helpers.addToolApprovalResponse({ id, approved }),
    [helpers]
  );

  // Codemode executions (the `execute` tool) pause durably instead of using
  // the AI SDK approval flow: Think resolves them via these callables, replays
  // the run and auto-continues the chat.
  const [resolvingExecutions, setResolvingExecutions] = useState(
    () => new Set<string>()
  );

  const handleExecutionApproval = useCallback(
    (executionId: string, approved: boolean) => {
      setResolvingExecutions((prev) => new Set(prev).add(executionId));
      // Both callables return `{ status: "error", error }` instead of
      // throwing when the run is stale or already resolved — surface that as
      // a toast, never an unhandled rejection.
      const call = approved
        ? chatAgent.stub.approveExecution(executionId)
        : chatAgent.stub.rejectExecution(executionId, REJECT_REASON);
      call
        .then((result) => {
          if (
            result &&
            typeof result === "object" &&
            "status" in result &&
            result.status === "error"
          ) {
            const errorText =
              ("error" in result ? result.error : undefined) ?? "Unknown error";
            console.error(
              `[ChatPage] ${approved ? "approveExecution" : "rejectExecution"} failed:`,
              errorText
            );
            toast.error(
              `Couldn't ${approved ? "approve" : "reject"}: this run already moved on.`,
              {
                position: "top-center",
              }
            );
          }
        })
        .catch((error: unknown) => {
          console.error(
            `[ChatPage] ${approved ? "approveExecution" : "rejectExecution"} failed`,
            error
          );
          toast.error("Couldn't resolve the execution. Please try again.", {
            position: "top-center",
          });
        })
        .finally(() => {
          setResolvingExecutions((prev) => {
            const next = new Set(prev);
            next.delete(executionId);
            return next;
          });
        });
    },
    [chatAgent]
  );

  // An in-flight call is rejected when its socket closes mid-flight. The
  // retry below is safe rather than clever: calls made while the socket is
  // closed are queued and flushed on open (30s timeout), and a reconnect
  // remounts the list anyway — so the paused card reloads instead of
  // sticking on "unavailable".
  const handleLoadPendingExecution = useCallback(
    (executionId: string): Promise<PendingAction[]> =>
      chatAgent.stub
        .pendingExecutions(executionId)
        .catch(() => chatAgent.ready)
        .then(() => chatAgent.stub.pendingExecutions(executionId)),
    [chatAgent]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      // Server-driven continuations (approvals, resume, other tabs) surface
      // through isStreaming too — never stack a regenerate on a live turn.
      if (chatBusy) {
        return;
      }
      return helpers.regenerate({ messageId });
    },
    [chatBusy, helpers]
  );

  const handleRetryTurn = useCallback(() => {
    if (chatBusy) {
      return;
    }
    // The AI SDK's documented retry for a failed turn: regenerate the last
    // assistant message (docs › Error Handling › Error Helper Object).
    return helpers.regenerate();
  }, [chatBusy, helpers]);

  const handleCopyConversation = useCallback(() => {
    const text = helpers.messages
      .map((message) => {
        const body = message.parts
          .filter(isTextUIPart)
          .map((part) => part.text)
          .join("\n");
        return `${message.role}: ${body}`;
      })
      .join("\n\n");
    navigator.clipboard.writeText(text).catch(() => undefined);
  }, [helpers.messages]);

  const handleCompact = useCallback(() => {
    const pending = toast.loading("Compacting conversation…", {
      position: "top-center",
    });
    return chatAgent.stub
      .compactNow()
      .then((result) => {
        toast.success(
          result.compacted
            ? "Conversation compacted"
            : "Nothing to compact yet",
          { id: pending, position: "top-center" }
        );
      })
      .catch((error: unknown) => {
        console.error("[ChatConnection] compactNow failed", error);
        toast.error("Couldn't compact the conversation.", {
          id: pending,
          position: "top-center",
        });
      });
  }, [chatAgent]);

  const handleDelete = useCallback(async () => {
    helpers.stop();
    try {
      await deleteChat(chatId);
    } catch {
      return; // deleteChat already toasted the failure.
    }
    const next = chats.find((chat) => chat.id !== chatId)?.id;
    navigate(
      next
        ? { params: { chatId: next }, to: "/chat/$chatId" }
        : { to: "/chat/new" }
    );
  }, [chatId, chats, deleteChat, helpers, navigate]);

  const hydrating = !(chatAgent.identified || chatAgent.connectionError);
  const streamingMessageId =
    chatBusy && helpers.messages.at(-1)?.role === "assistant"
      ? (helpers.messages.at(-1)?.id ?? null)
      : null;

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            className="size-7 shrink-0"
            size="icon"
            type="button"
            variant="ghost"
          />
        }
      >
        <MoreHorizontalIcon />
        <span className="sr-only">More actions</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handleCopyConversation}>
          <ClipboardCopyIcon />
          Copy conversation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCompact}>
          <ShrinkIcon />
          Compact conversation
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} variant="destructive">
          <Trash2Icon />
          Delete conversation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <ChatColumn
        body={
          <MessageScrollerProvider autoScroll>
            <MessageScroller className="h-0 min-h-0 flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-6 p-4">
                  {hydrating ? <HydratingSkeleton /> : null}
                  {!hydrating && chatAgent.connectionError ? (
                    <ChatUnavailable error={chatAgent.connectionError} />
                  ) : null}
                  {hydrating || chatAgent.connectionError ? null : (
                    <MessageListOrEmpty
                      messages={helpers.messages}
                      resolvingExecutions={resolvingExecutions}
                      streamingMessageId={streamingMessageId}
                      onExecutionApproval={handleExecutionApproval}
                      onLoadPendingExecution={handleLoadPendingExecution}
                      onRegenerate={handleRegenerate}
                      onToolApproval={handleToolApproval}
                    />
                  )}
                  {helpers.error ? (
                    <TurnErrorBanner
                      message={helpers.error.message}
                      onDismiss={helpers.clearError}
                      onRetry={handleRetryTurn}
                    />
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        }
        footer={
          <ChatComposer
            status={chatBusy ? "streaming" : helpers.status}
            onSubmit={(message) => {
              const plan = firstSendPlan(message);
              if (!plan) {
                return;
              }
              return sendMessage(toSendableMessage(plan.outgoing));
            }}
            onStop={helpers.stop}
          />
        }
        header={
          <ChatHeader
            menu={menu}
            onTogglePanel={sidePanel.togglePanel}
            panelOpen={sidePanel.panelOpen}
            title={title}
          />
        }
      />
      {sidePanel.panelOpen ? (
        <>
          <ResizableHandle className="bg-transparent" />
          <ResizablePanel
            className="ml-px flex min-h-0 flex-col overflow-hidden rounded-l-xl border-border border-l bg-accent/5 shadow"
            defaultSize="32%"
            maxSize="55%"
            minSize="22%"
          >
            <ChatSidePanel
              activeTab={sidePanel.activeTab}
              activeTabId={sidePanel.activeTabId}
              onClosePanel={sidePanel.closePanel}
              onCloseTab={sidePanel.closeTab}
              onOpenFile={sidePanel.openFileTab}
              onSelectTab={sidePanel.setActiveTabId}
              tabs={sidePanel.tabs}
            />
          </ResizablePanel>
        </>
      ) : null}
    </>
  );
}

function ChatColumn({
  header,
  body,
  footer,
}: {
  header: ReactNode;
  body: ReactNode;
  footer: ReactNode;
}) {
  return (
    <ResizablePanel
      className="flex min-h-0 flex-col overflow-hidden"
      defaultSize="100%"
      minSize="45%"
    >
      {header}
      {body}
      {footer}
    </ResizablePanel>
  );
}

function ChatUnavailable({
  error,
}: {
  error: Error & { code: number; reason: string; wasClean: boolean };
}) {
  // connectionError only carries terminal closes (1008/4xxx); an unknown chat
  // never gets this far (chatRouteState shows "Chat not found" from state).
  const notFound = error.reason.includes("not found");
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MessageCircleDashedIcon />
        </EmptyMedia>
        <EmptyTitle>
          {notFound ? "Chat not found" : "Connection lost"}
        </EmptyTitle>
        <EmptyDescription>
          {notFound
            ? "This conversation doesn't exist (it may have been deleted). Head back to Chats and pick another."
            : `Couldn't reach the chat: ${error.reason || error.message || "connection error"}. Reload to retry.`}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
