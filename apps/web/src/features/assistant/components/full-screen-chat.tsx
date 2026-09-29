"use client";

import { useAgentChat } from "@cloudflare/think/react";
import { useNavigate } from "@tanstack/react-router";
import type { ChatSummary } from "@workspace/agent/types";
import {
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderIcon,
  ShellHeaderSidebarTrigger,
  ShellHeaderTitle,
} from "@workspace/ui/components/brand/shell";
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
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/shadcn/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
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
  BotIcon,
  ClipboardCopyIcon,
  MessageCircleDashedIcon,
  MoreHorizontalIcon,
  PanelRightIcon,
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
import { useAgentToolMutationInvalidation } from "@/hooks/use-agent-tool-mutation-invalidation";
import { useOrgConnection } from "../connection/org-connection";
import { useChatSidePanel } from "../hooks/use-chat-side-panel";
import { useWorkspaceTree } from "../hooks/use-workspace-tree";
import {
  type OrgChatMessage,
  type OutgoingUserMessage,
  toSendableMessage,
} from "../lib/ai-types";
import { defaultNewChatTitle } from "../lib/chat-titles";
import { firstSendPlan } from "../lib/first-send";
import { ChatComposer, type PromptMessage } from "./chat-input";
import { ChatMessageRow } from "./chat-message-parts";
import { ChatSidePanel } from "./chat-side-panel";

function EmptyConversation() {
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

function chatTitleOf(chats: ChatSummary[], chatId: string | null): string {
  if (!chatId) {
    return defaultNewChatTitle();
  }
  return chats.find((chat) => chat.id === chatId)?.title ?? "Chat";
}

function errorMessageFrom(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return "Couldn't send your message. Please try again.";
}

/**
 * The chat page. `chatId === null` is a draft: nothing connects until the
 * first send, which creates the chat via `OrgAgent.createChat` and hands off
 * to `/chat/$chatId` — no empty chats pile up (matches the starter's dock).
 */
export function FullScreenChat({ chatId }: { chatId: string | null }) {
  const { chats } = useOrgConnection();
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
        {chatId === null ? (
          <DraftView title={chatTitleOf(chats, null)} />
        ) : (
          <ChatView
            key={chatId}
            chatId={chatId}
            title={chatTitleOf(chats, chatId)}
          />
        )}
      </ResizablePanelGroup>
    </div>
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
        setPendingMessage(plan.outgoing);
        navigate({
          params: { chatId: chat.id },
          replace: true,
          to: "/chat/$chatId",
        });
      } catch (error) {
        console.error("[FullScreenChat] createChat failed", error);
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
  const [sendError, setSendError] = useState<string | null>(null);

  const chatAgent = useAgent({
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
    // stream. This matches the Think reference client. (ALW-401)
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

  // ALW-500: invalidate React Query when agent write tools complete.
  useAgentToolMutationInvalidation({ messages: helpers.messages });

  // Flush the draft message bridged from `/` once the socket is identified and
  // the hook is ready to send. Deduped by object identity (strict-mode safe).
  const lastSentRef = useRef<OutgoingUserMessage | null>(null);
  const { sendMessage } = helpers;
  // biome-ignore lint/plugin/no-use-effect: flush the bridged draft once the connection is ready
  useEffect(() => {
    if (!pendingMessage || helpers.status !== "ready" || sendError !== null) {
      return;
    }
    if (lastSentRef.current === pendingMessage) {
      return;
    }
    lastSentRef.current = pendingMessage;
    const message = pendingMessage;
    clearPendingMessage();
    sendMessage(toSendableMessage(message)).catch((error: unknown) => {
      console.error("[ChatConnection] sendMessage failed", error);
      lastSentRef.current = null;
      setSendError(errorMessageFrom(error));
    });
  }, [
    pendingMessage,
    helpers.status,
    sendError,
    sendMessage,
    clearPendingMessage,
  ]);

  const handleToolApproval = useCallback(
    (id: string, approved: boolean) =>
      helpers.addToolApprovalResponse({ id, approved }),
    [helpers]
  );

  const handleRegenerate = useCallback(
    (messageId: string) => {
      setSendError(null);
      helpers.regenerate({ messageId }).catch((error: unknown) => {
        console.error("[ChatConnection] regenerate failed", error);
        setSendError(errorMessageFrom(error));
      });
    },
    [helpers]
  );

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
    return chatAgent
      .call("compactNow", [])
      .then((result) => {
        const compacted =
          typeof result === "object" &&
          result !== null &&
          "compacted" in result &&
          result.compacted === true;
        toast.success(
          compacted ? "Conversation compacted" : "Nothing to compact yet",
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
    navigate({
      params: { chatId: next ?? "new" },
      to: "/chat/$chatId",
    });
  }, [chatId, chats, deleteChat, helpers, navigate]);

  const hydrating = !(chatAgent.identified || chatAgent.connectionError);
  const streamingMessageId =
    helpers.status === "streaming" &&
    helpers.messages.at(-1)?.role === "assistant"
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
                  {hydrating ? (
                    <HydratingSkeleton />
                  ) : (
                    <MessageListOrEmpty
                      messages={helpers.messages}
                      streamingMessageId={streamingMessageId}
                      onRegenerate={handleRegenerate}
                      onToolApproval={handleToolApproval}
                    />
                  )}
                  {sendError ? (
                    <p className="text-destructive text-sm">{sendError}</p>
                  ) : null}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        }
        footer={
          <ChatComposer
            onSubmit={(message) => {
              const plan = firstSendPlan(message);
              if (!plan) {
                return;
              }
              // The composer swallows rejections; surface send failures the
              // same way the bridged-draft flush does.
              return sendMessage(toSendableMessage(plan.outgoing))
                .then(() => undefined)
                .catch((error: unknown) => {
                  console.error("[ChatConnection] sendMessage failed", error);
                  setSendError(errorMessageFrom(error));
                });
            }}
            onStop={helpers.stop}
            status={helpers.status}
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
            <ChatSidePanelController
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

/** Mounts the workspace tree hook only while the panel is open. */
function ChatSidePanelController({
  onOpenFile,
  ...props
}: {
  tabs: { id: string; path: string; name: string }[];
  activeTab: { id: string; path: string; name: string } | null;
  activeTabId: string | null;
  onClosePanel: () => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  const tree = useWorkspaceTree();
  return <ChatSidePanel {...props} onOpenFile={onOpenFile} tree={tree} />;
}

function MessageListOrEmpty({
  messages,
  streamingMessageId,
  onRegenerate,
  onToolApproval,
}: {
  messages: OrgChatMessage[];
  streamingMessageId: string | null;
  onRegenerate: (messageId: string) => void;
  onToolApproval: (id: string, approved: boolean) => void;
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
            onRegenerate={onRegenerate}
            onToolApproval={onToolApproval}
          />
        </MessageScrollerItem>
      ))}
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

function ChatHeader({
  title,
  menu,
  panelOpen,
  onTogglePanel,
}: {
  title: string;
  menu: ReactNode;
  panelOpen: boolean;
  onTogglePanel?: () => void;
}) {
  return (
    <ShellHeader className="px-3" data-slot="full-screen-chat-header">
      <ShellHeaderSidebarTrigger className="-ml-1" />
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <ShellHeaderIcon>
          <BotIcon />
        </ShellHeaderIcon>
        <ShellHeaderTitle>{title}</ShellHeaderTitle>
        {menu}
      </div>
      {panelOpen || !onTogglePanel ? null : (
        <ShellHeaderActions>
          <Button
            className="size-7 shrink-0"
            onClick={onTogglePanel}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelRightIcon />
            <span className="sr-only">Open side panel</span>
          </Button>
        </ShellHeaderActions>
      )}
    </ShellHeader>
  );
}

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
