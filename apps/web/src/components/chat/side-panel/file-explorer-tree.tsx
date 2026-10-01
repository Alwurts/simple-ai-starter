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
import { useWorkspaceDirectory } from "@/hooks/chat/use-workspace-queries";

/**
 * Read-only org workspace file tree. The root loads when the panel opens; an
 * expanded folder fetches its children only while mounted (first expand),
 * cached by TanStack Query and invalidated by the `workspace-change`
 * broadcast, so re-expanding is instant and failures can be retried.
 * Expansion state lives in the caller so it survives the panel's layout
 * switches.
 */
export function FileExplorerTree({
  onOpenFile,
  expandedDirs,
  onToggleDir,
  selectedPath,
  className,
}: {
  /** Notified alongside opening a file (e.g. to open a panel tab). */
  onOpenFile?: (path: string, name: string) => void;
  /** Expanded directory paths, held above the tree. */
  expandedDirs: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  /** Active tab path — the selected file row is highlighted. */
  selectedPath: string | null;
  className?: string;
}) {
  const root = useWorkspaceDirectory("/");

  if (root.isPending) {
    return <TreeLoading className={className} />;
  }

  if (root.isError) {
    return (
      <TreeError
        className={cn("px-3 py-6", className)}
        message="Couldn't load the workspace."
        onRetry={() => root.refetch()}
      />
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
          expandedDirs={expandedDirs}
          key={entry.path}
          onOpenFile={onOpenFile}
          onToggleDir={onToggleDir}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}

function FileExplorerTreeNode({
  entry,
  depth = 0,
  expandedDirs,
  onToggleDir,
  onOpenFile,
  selectedPath,
}: {
  entry: WorkspaceFileInfo;
  depth?: number;
  expandedDirs: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  onOpenFile?: (path: string, name: string) => void;
  selectedPath: string | null;
}) {
  if (entry.type !== "directory") {
    return (
      <FileNode
        entry={entry}
        selected={selectedPath === entry.path}
        onOpenFile={onOpenFile}
      />
    );
  }
  return (
    <DirectoryNode
      depth={depth}
      entry={entry}
      expanded={expandedDirs.has(entry.path)}
      expandedDirs={expandedDirs}
      onToggleDir={onToggleDir}
      onOpenFile={onOpenFile}
      selectedPath={selectedPath}
    />
  );
}

function FileNode({
  entry,
  selected,
  onOpenFile,
}: {
  entry: WorkspaceFileInfo;
  selected: boolean;
  onOpenFile?: (path: string, name: string) => void;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted hover:text-foreground",
        selected ? "bg-muted text-foreground" : "text-muted-foreground"
      )}
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
  expanded,
  expandedDirs,
  onToggleDir,
  onOpenFile,
  selectedPath,
}: {
  entry: WorkspaceFileInfo;
  depth: number;
  expanded: boolean;
  expandedDirs: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  onOpenFile?: (path: string, name: string) => void;
  selectedPath: string | null;
}) {
  return (
    <div data-slot="file-explorer-tree-folder">
      <button
        className="group flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left hover:bg-muted"
        onClick={() => onToggleDir(entry.path)}
        type="button"
      >
        <ChevronRightIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-90"
          )}
        />
        <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{entry.name}</span>
      </button>
      {expanded ? (
        <div className="ml-3.5 flex flex-col gap-0.5 border-border/60 border-l pl-1.5">
          <DirectoryChildren
            depth={depth}
            dir={entry.path}
            expandedDirs={expandedDirs}
            onOpenFile={onOpenFile}
            onToggleDir={onToggleDir}
            selectedPath={selectedPath}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Children of one expanded directory; mounted only while expanded. */
function DirectoryChildren({
  dir,
  depth,
  expandedDirs,
  onToggleDir,
  onOpenFile,
  selectedPath,
}: {
  dir: string;
  depth: number;
  expandedDirs: ReadonlySet<string>;
  onToggleDir: (path: string) => void;
  onOpenFile?: (path: string, name: string) => void;
  selectedPath: string | null;
}) {
  const query = useWorkspaceDirectory(dir);

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
      <TreeError
        className="px-2 py-1.5 text-xs"
        message="Couldn't load this folder."
        onRetry={() => query.refetch()}
      />
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
          expandedDirs={expandedDirs}
          key={child.path}
          onOpenFile={onOpenFile}
          onToggleDir={onToggleDir}
          selectedPath={selectedPath}
        />
      ))}
    </>
  );
}

function TreeError({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col items-start gap-2 py-2 text-sm", className)}
    >
      <p className="text-destructive">{message}</p>
      <button
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-foreground text-xs hover:bg-muted"
        onClick={onRetry}
        type="button"
      >
        <RotateCcwIcon className="size-3" />
        Retry
      </button>
    </div>
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
