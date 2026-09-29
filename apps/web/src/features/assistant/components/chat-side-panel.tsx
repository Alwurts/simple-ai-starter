"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/shadcn/resizable";
import { cn } from "@workspace/ui/lib/utils";
import {
  FileIcon,
  Loader2Icon,
  PanelRightCloseIcon,
  XIcon,
} from "lucide-react";
import { isTextFile, type WorkspaceTree } from "../hooks/use-workspace-tree";
import { FileExplorerTree } from "./file-explorer-tree";

/**
 * Read-only view over the org's shared workspace (`OrgAgent.listWorkspace` /
 * `readWorkspaceFile`). Opening a file shows its text; everything refetches
 * live on the `workspace-change` broadcast (see `useWorkspaceTree`).
 */
export function ChatSidePanel({
  tabs,
  activeTab,
  activeTabId,
  onClosePanel,
  onCloseTab,
  onSelectTab,
  onOpenFile,
  tree,
}: {
  tabs: { id: string; path: string; name: string }[];
  activeTab: { id: string; path: string; name: string } | null;
  activeTabId: string | null;
  onClosePanel: () => void;
  onCloseTab: (tabId: string) => void;
  onSelectTab: (tabId: string) => void;
  onOpenFile: (path: string, name: string) => void;
  tree: WorkspaceTree;
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
          <ResizablePanelGroup
            data-slot="chat-side-panel-files-split"
            orientation="horizontal"
          >
            <ResizablePanel className="min-h-0" defaultSize="65%" minSize="40%">
              <FileContent tree={tree} />
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel
              className="min-h-0 overflow-auto bg-background"
              defaultSize="35%"
              maxSize="55%"
              minSize="20%"
            >
              <FileExplorerTree onOpenFile={onOpenFile} tree={tree} />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
            data-slot="chat-side-panel-empty"
          >
            <p className="font-medium text-sm">Org workspace</p>
            <p className="max-w-xs text-muted-foreground text-xs">
              Files the assistant writes for this organization — shared across
              every chat — can be browsed here, read-only.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function FileContent({ tree }: { tree: WorkspaceTree }) {
  if (!tree.selectedPath) {
    return <NoFileSelected />;
  }
  const name = tree.selectedName ?? tree.selectedPath;
  if (tree.fileState === "loading") {
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
        {tree.selectedPath}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {tree.fileContent ??
          (tree.fileState === "error" ? "// Couldn't load this file." : "")}
      </pre>
    </div>
  );
}

function NoFileSelected() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
      data-slot="no-file-selected"
    >
      <FileIcon className="size-6 text-muted-foreground" />
      <p className="font-medium text-sm">No file selected</p>
      <p className="max-w-xs text-muted-foreground text-xs">
        Select a file from the tree to preview its contents.
      </p>
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
