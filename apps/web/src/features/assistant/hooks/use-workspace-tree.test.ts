import { describe, expect, it } from "vitest";
import { workspaceRefreshTargets } from "./use-workspace-tree";

describe("workspaceRefreshTargets", () => {
  it("skips the initial version so mount does not refetch", () => {
    expect(workspaceRefreshTargets(0, ["/"], "/notes.md")).toBeNull();
  });

  it("refetches every loaded directory and the open file after a change", () => {
    expect(workspaceRefreshTargets(2, ["/", "/src"], "/src/a.ts")).toEqual({
      dirs: ["/", "/src"],
      filePath: "/src/a.ts",
    });
  });

  it("refetches directories when no file is open", () => {
    expect(workspaceRefreshTargets(1, ["/"], null)).toEqual({
      dirs: ["/"],
      filePath: null,
    });
  });
});
