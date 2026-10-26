import { describe, expect, it, vi } from "vitest";
import { WORKSPACE_ROOT } from "../constants";
import {
  confineToWorkspaceRoot,
  listPanelDirectory,
  readPanelFile,
} from "./workspace-panel";

describe("confineToWorkspaceRoot", () => {
  it("keeps the root and resolves paths inside it", () => {
    expect(confineToWorkspaceRoot(WORKSPACE_ROOT)).toBe("/workspace");
    expect(confineToWorkspaceRoot("/workspace/")).toBe("/workspace");
    expect(confineToWorkspaceRoot("/workspace/docs/")).toBe("/workspace/docs");
    expect(confineToWorkspaceRoot("/workspace//docs///note.txt")).toBe(
      "/workspace/docs/note.txt"
    );
    expect(confineToWorkspaceRoot("/workspace/./docs/../note.txt")).toBe(
      "/workspace/note.txt"
    );
    expect(confineToWorkspaceRoot("note.txt")).toBe("/workspace/note.txt");
    expect(confineToWorkspaceRoot("docs/note.txt")).toBe(
      "/workspace/docs/note.txt"
    );
    expect(confineToWorkspaceRoot("//workspace//note.txt")).toBe(
      "/workspace/note.txt"
    );
  });

  it("rejects anything outside the root", () => {
    expect(confineToWorkspaceRoot("/")).toBeNull();
    expect(confineToWorkspaceRoot("/etc")).toBeNull();
    expect(confineToWorkspaceRoot("/.computer/output")).toBeNull();
    expect(confineToWorkspaceRoot("/workspace-other")).toBeNull();
    expect(confineToWorkspaceRoot("/workspace-other/note.txt")).toBeNull();
    expect(confineToWorkspaceRoot("/workspace/../x")).toBeNull();
    expect(confineToWorkspaceRoot("/workspace/docs/../../x")).toBeNull();
    expect(confineToWorkspaceRoot("..")).toBeNull();
    expect(confineToWorkspaceRoot("../etc")).toBeNull();
    expect(confineToWorkspaceRoot("")).toBeNull();
  });
});

function fsError(code: string): Error {
  const error = new Error(code);
  error.name = "WorkspaceFsError";
  (error as { code?: string }).code = code;
  return error;
}

function node(kind: "file" | "dir" | "link") {
  return {
    name: "entry",
    inode: 1,
    mode: 0,
    mtime: 0,
    size: 0,
    isFile: kind === "file",
    isDirectory: kind === "dir",
    isSymbolicLink: kind === "link",
  };
}

describe("listPanelDirectory", () => {
  it("lists a missing directory and an outside path as []", async () => {
    const lstat = vi.fn(() => Promise.reject(fsError("ENOENT")));
    const readdir = vi.fn();
    const fs = { lstat, readdir, readFile: vi.fn() };
    expect(await listPanelDirectory(fs)).toEqual([]);
    expect(lstat).toHaveBeenCalledWith("/workspace");
    expect(await listPanelDirectory(fs, "/etc")).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });

  it("lists a file path and a symlink path as []", async () => {
    const lstat = vi
      .fn()
      .mockResolvedValueOnce(node("file"))
      .mockResolvedValueOnce(node("link"));
    const readdir = vi.fn();
    const fs = { lstat, readdir, readFile: vi.fn() };
    expect(await listPanelDirectory(fs, "/workspace/note.txt")).toEqual([]);
    expect(await listPanelDirectory(fs, "/workspace/out")).toEqual([]);
    expect(readdir).not.toHaveBeenCalled();
  });

  it("lists a symlink entry as a file", async () => {
    const lstat = vi.fn(() => Promise.resolve(node("dir")));
    const readdir = vi.fn().mockResolvedValue([
      {
        name: "link",
        isDirectory: true,
        isSymbolicLink: true,
      },
      {
        name: "docs",
        isDirectory: true,
        isSymbolicLink: false,
      },
    ]);
    const fs = { lstat, readdir, readFile: vi.fn() };
    expect(await listPanelDirectory(fs, "/workspace")).toEqual([
      { path: "/workspace/link", name: "link", type: "file" },
      { path: "/workspace/docs", name: "docs", type: "directory" },
    ]);
  });
});

describe("readPanelFile", () => {
  it("returns text, and null for a missing file, a directory, a symlink, or an outside path", async () => {
    const lstat = vi
      .fn()
      .mockResolvedValueOnce(node("file"))
      .mockRejectedValueOnce(fsError("ENOENT"))
      .mockResolvedValueOnce(node("dir"))
      .mockResolvedValueOnce(node("link"));
    const readFile = vi.fn().mockResolvedValue("hello");
    const fs = { lstat, readdir: vi.fn(), readFile };
    expect(await readPanelFile(fs, "/workspace/note.txt")).toBe("hello");
    expect(await readPanelFile(fs, "/workspace/missing.txt")).toBeNull();
    expect(await readPanelFile(fs, "/workspace/docs")).toBeNull();
    expect(await readPanelFile(fs, "/workspace/out")).toBeNull();
    expect(await readPanelFile(fs, "/etc/passwd")).toBeNull();
    expect(await readPanelFile(fs, "/workspace/../x")).toBeNull();
    expect(readFile).toHaveBeenCalledTimes(1);
    expect(readFile).toHaveBeenCalledWith("/workspace/note.txt", "utf8");
  });
});
