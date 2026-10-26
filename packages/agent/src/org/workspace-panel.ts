import type { Workspace } from "@cloudflare/computer";
import { WORKSPACE_ROOT } from "../constants";
import type { WorkspaceFileInfo } from "../types";

type PanelFs = Pick<Workspace["fs"], "lstat" | "readdir" | "readFile">;

export function confineToWorkspaceRoot(input: string): string | null {
  if (typeof input !== "string" || input.length === 0) {
    return null;
  }
  const absolute = input.startsWith("/") ? input : `${WORKSPACE_ROOT}/${input}`;
  const parts: string[] = [];
  for (const part of absolute.split("/")) {
    if (part === "" || part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length === 0) {
        return null;
      }
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  const canonical = parts.length === 0 ? "/" : `/${parts.join("/")}`;
  if (
    canonical !== WORKSPACE_ROOT &&
    !canonical.startsWith(`${WORKSPACE_ROOT}/`)
  ) {
    return null;
  }
  return canonical;
}

function childPath(dir: string, name: string): string {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

/**
 * Computer throws a plain `Error` named `WorkspaceFsError` with a `code`
 * (`ENOENT`, `ENOTDIR`, `EISDIR`, `EINVAL`). It is not a subclass.
 */
function workspaceFsCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    error.name === "WorkspaceFsError" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
}

export async function listPanelDirectory(
  fs: PanelFs,
  dir: string = WORKSPACE_ROOT
): Promise<WorkspaceFileInfo[]> {
  const path = confineToWorkspaceRoot(dir);
  if (!path) {
    return [];
  }
  try {
    const stat = await fs.lstat(path);
    // readdir follows the last symlink, so a link would list its target.
    if (!stat.isDirectory || stat.isSymbolicLink) {
      return [];
    }
    const entries = await fs.readdir(path);
    return entries.map((entry) => ({
      path: childPath(path, entry.name),
      name: entry.name,
      type: entry.isDirectory && !entry.isSymbolicLink ? "directory" : "file",
    }));
  } catch (error) {
    const code = workspaceFsCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }
    throw error;
  }
}

export async function readPanelFile(
  fs: PanelFs,
  path: string
): Promise<string | null> {
  const confined = confineToWorkspaceRoot(path);
  if (!confined) {
    return null;
  }
  try {
    const stat = await fs.lstat(confined);
    if (!stat.isFile || stat.isSymbolicLink) {
      return null;
    }
    return await fs.readFile(confined, "utf8");
  } catch (error) {
    const code = workspaceFsCode(error);
    if (code === "ENOENT" || code === "EISDIR") {
      return null;
    }
    throw error;
  }
}
