"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import type { WorkspaceFileInfo } from "@workspace/agent/types";
import { useOrgConnection } from "@/components/chat/connection/org-connection";

/**
 * Root of every workspace key: `[orgId, "workspace", …]`. Org-scoped so a
 * org switch can never serve another org's tree; the OrgAgent's
 * `workspace-change` broadcast invalidates this prefix.
 */
export const workspaceQueryKey = (organizationId: string) =>
  [organizationId, "workspace"] as const;

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

/** The open file's text; a null path means no file is open (query disabled). */
export function useWorkspaceFile(path: string | null) {
  const { organizationId, readWorkspaceFile } = useOrgConnection();
  return useQuery({
    ...workspaceFileQueryOptions({
      organizationId,
      path: path ?? "",
      readWorkspaceFile,
    }),
    enabled: path !== null,
  });
}
