"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import { cn } from "@workspace/ui/lib/utils";
import {
  FileIcon,
  Loader2Icon,
  PanelRightCloseIcon,
  XIcon,
} from "lucide-react";
import { useWorkspaceFile } from "@/hooks/chat/use-workspace-queries";
import { isTextFile } from "@/lib/chat/workspace-files";
import { FileExplorerTree } from "./file-explorer-tree";

/**
 * Read-only view over the org's shared workspace (`OrgAgent.listWorkspace` /
 * `readWorkspaceFile`). The open tab's file is shown; every directory and file
 * is a TanStack Query invalidated by the `workspace-change` broadcast (see
 * `use-workspace-queries.ts`).
 */
export function ChatSidePanel({
  tabs,
  activeTab,
  activeTabId,
  onClosePanel,
  onCloseTab,
  onSelectTab,
  onOpenFile,
}: {
  tabs: { id: string; path: string; name: string }[];
  activeTab: { id: string; path: string; name: string } | null;
  activeTabId: string | null;
  onClosePanel: () => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  onOpenFile: (path: string, name: string) => void;
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col bg-muted/15"
      data-slot="chat-side-panel"
    >
      <div
        className="flex items-center gap-1 border-b bg-background px-2 py-1.5"
        data-slot="chat-side-panel-toolbar"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              className={cn(
                "group flex max-w-[180px] shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs",
                isActive
                  ? "border-border bg-muted text-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted/60"
              )}
              key={tab.id}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-1.5"
                onClick={() => onSelectTab(tab.id)}
                type="button"
              >
                <FileIcon className="size-3 shrink-0" />
                <span className="truncate">{tab.name}</span>
              </button>
              <button
                className="rounded-sm p-0.5 opacity-60 hover:bg-background hover:opacity-100"
                onClick={() => onCloseTab(tab.id)}
                type="button"
              >
                <XIcon className="size-3" />
                <span className="sr-only">Close tab</span>
              </button>
            </div>
          );
        })}
        <Button
          className="ml-auto size-7"
          onClick={onClosePanel}
          size="icon"
          type="button"
          variant="ghost"
        >
          <PanelRightCloseIcon className="size-3.5" />
          <span className="sr-only">Close panel</span>
        </Button>
      </div>

      <div
        className="min-h-0 flex-1 overflow-hidden"
        data-slot="chat-side-panel-content"
      >
        {activeTab ? (
          <div
            className="@container/files h-full min-h-0"
            data-slot="chat-side-panel-files-split"
          >
            <div className="grid h-full min-h-0 @min-[36rem]/files:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)] @min-[36rem]/files:grid-rows-1 grid-rows-[minmax(9rem,40%)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-auto @min-[36rem]/files:border-r border-b @min-[36rem]/files:border-b-0 bg-background">
                <FileExplorerTree onOpenFile={onOpenFile} />
              </div>
              <div className="min-h-0 overflow-hidden">
                <FileContent name={activeTab.name} path={activeTab.path} />
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex h-full min-h-0 flex-col"
            data-slot="chat-side-panel-empty"
          >
            <div className="border-b px-3 py-2">
              <p className="font-medium text-sm">Org workspace</p>
              <p className="text-muted-foreground text-xs">
                Shared across every chat. Read-only.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <FileExplorerTree onOpenFile={onOpenFile} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FileContent({ path, name }: { path: string; name: string }) {
  const file = useWorkspaceFile(path);

  if (file.isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground text-sm">
        <Loader2Icon className="size-4 animate-spin" />
        Loading…
      </div>
    );
  }
  if (!isTextFile({ mimeType: null, name })) {
    return (
      <PanelPlaceholder
        description={`${name} isn't a text file — only text previews are supported here.`}
        title={name}
      />
    );
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-3 py-2 text-muted-foreground text-xs">
        {path}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {file.isError ? "// Couldn't load this file." : (file.data ?? "")}
      </pre>
    </div>
  );
}

function PanelPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-medium text-sm">{title}</p>
      <p className="max-w-xs text-muted-foreground text-xs">{description}</p>
    </div>
  );
}
