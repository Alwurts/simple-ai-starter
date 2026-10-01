"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import type { WorkspaceFileInfo } from "@workspace/agent/types";
import { useOrgConnection } from "@/components/chat/connection/org-connection";
import { workspaceQueryKey } from "@/lib/chat/workspace-query-key";

/** Directory entries of the org workspace at `path` (lazy per directory). */
export function workspaceDirectoryQueryOptions(options: {
  organizationId: string;
  listWorkspace: (path?: string) => Promise<WorkspaceFileInfo[]>;
  path: string;
}) {
  return queryOptions({
    queryKey: [
      ...workspaceQueryKey(options.organizationId),
      "dir",
      options.path,
    ],
    queryFn: () => options.listWorkspace(options.path),
  });
}

/** A workspace file's text contents (null when absent/binary). */
export function workspaceFileQueryOptions(options: {
  organizationId: string;
  readWorkspaceFile: (path: string) => Promise<string | null>;
  path: string;
}) {
  return queryOptions({
    queryKey: [
      ...workspaceQueryKey(options.organizationId),
      "file",
      options.path,
    ],
    queryFn: () => options.readWorkspaceFile(options.path),
  });
}

export function useWorkspaceDirectory(path: string) {
  const { organizationId, listWorkspace } = useOrgConnection();
  return useQuery(
    workspaceDirectoryQueryOptions({ listWorkspace, organizationId, path })
  );
}

/** The open file's text. */
export function useWorkspaceFile(path: string) {
  const { organizationId, readWorkspaceFile } = useOrgConnection();
  return useQuery(
    workspaceFileQueryOptions({ organizationId, path, readWorkspaceFile })
  );
}
