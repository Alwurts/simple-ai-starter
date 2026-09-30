"use client";

import type { WorkspaceFileInfo } from "@workspace/agent/types";
import { cn } from "@workspace/ui/lib/utils";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  Loader2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { useState } from "react";
import { useWorkspaceDirectory } from "@/hooks/chat/use-workspace-queries";

/**
 * Read-only org workspace file tree. Every directory — root included — loads
 * its entries through its own query (`OrgAgent.listWorkspace`), so expanded
 * folders reopen instantly from cache, the `workspace-change` broadcast
 * invalidates them, and a failed root load shows Retry instead of spinning.
 */
export function FileExplorerTree({
  onOpenFile,
  className,
}: {
  /** Notified alongside opening a file (e.g. to open a panel tab). */
  onOpenFile?: (path: string, name: string) => void;
  className?: string;
}) {
  const root = useWorkspaceDirectory("/");

  if (root.isPending) {
    return <TreeLoading className={className} />;
  }

  if (root.isError) {
    return (
      <div
        className={cn(
          "flex flex-col items-start gap-2 px-3 py-6 text-sm",
          className
        )}
      >
        <p className="text-destructive">Couldn't load the workspace.</p>
        <button
          className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-foreground text-xs hover:bg-muted"
          onClick={() => root.refetch()}
          type="button"
        >
          <RotateCcwIcon className="size-3" />
          Retry
        </button>
      </div>
    );
  }

  if (root.data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 px-4 py-10 text-center",
          className
        )}
      >
        <FolderIcon className="size-6 text-muted-foreground" />
        <p className="font-medium text-sm">No files yet</p>
        <p className="max-w-xs text-muted-foreground text-xs">
          Files the assistant creates in this org workspace will appear here.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-col gap-0.5 p-2 text-sm", className)}
      data-slot="file-explorer-tree"
    >
      {sortEntries(root.data).map((entry) => (
        <FileExplorerTreeNode
          entry={entry}
          key={entry.path}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

function FileExplorerTreeNode({
  entry,
  depth = 0,
  onOpenFile,
}: {
  entry: WorkspaceFileInfo;
  depth?: number;
  onOpenFile?: (path: string, name: string) => void;
}) {
  if (entry.type !== "directory") {
    return <FileNode entry={entry} onOpenFile={onOpenFile} />;
  }
  return <DirectoryNode depth={depth} entry={entry} onOpenFile={onOpenFile} />;
}

function FileNode({
  entry,
  onOpenFile,
}: {
  entry: WorkspaceFileInfo;
  onOpenFile?: (path: string, name: string) => void;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground"
      data-slot="file-explorer-tree-file"
      onClick={() => onOpenFile?.(entry.path, entry.name)}
      type="button"
    >
      <FileIcon className="size-3.5 shrink-0" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

function DirectoryNode({
  entry,
  depth,
  onOpenFile,
}: {
  entry: WorkspaceFileInfo;
  depth: number;
  onOpenFile?: (path: string, name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // Fetches on first expand; cached afterwards and invalidated on
  // `workspace-change`, so re-expanding never re-hits the socket when fresh.
  const children = useWorkspaceDirectory(entry.path);

  return (
    <div data-slot="file-explorer-tree-folder">
      <button
        className="group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90"
          )}
        />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{entry.name}</span>
      </button>
      {open ? (
        <div className="ml-3.5 flex flex-col gap-0.5 border-border/60 border-l pl-1.5">
          <DirectoryChildren
            depth={depth}
            onOpenFile={onOpenFile}
            query={children}
          />
        </div>
      ) : null}
    </div>
  );
}

function DirectoryChildren({
  depth,
  query,
  onOpenFile,
}: {
  depth: number;
  query: ReturnType<typeof useWorkspaceDirectory>;
  onOpenFile?: (path: string, name: string) => void;
}) {
  if (query.isPending) {
    return (
      <span className="flex items-center gap-1.5 px-2 py-1.5 text-muted-foreground text-xs">
        <Loader2Icon className="size-3 animate-spin" />
        Loading…
      </span>
    );
  }
  if (query.isError) {
    return (
      <span className="px-2 py-1.5 text-destructive text-xs">
        Couldn't load this folder.
      </span>
    );
  }
  if (query.data.length === 0) {
    return (
      <span className="px-2 py-1.5 text-muted-foreground text-xs">Empty</span>
    );
  }
  return (
    <>
      {sortEntries(query.data).map((child) => (
        <FileExplorerTreeNode
          depth={depth + 1}
          entry={child}
          key={child.path}
          onOpenFile={onOpenFile}
        />
      ))}
    </>
  );
}

function TreeLoading({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-4 text-muted-foreground text-sm",
        className
      )}
    >
      <Loader2Icon className="size-3.5 animate-spin" />
      Loading workspace…
    </div>
  );
}

function sortEntries(entries: WorkspaceFileInfo[]): WorkspaceFileInfo[] {
  return [...entries].sort((a, b) => {
    const aDir = a.type === "directory";
    const bDir = b.type === "directory";
    if (aDir !== bDir) {
      return aDir ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
