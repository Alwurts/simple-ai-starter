import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const UI_ROOT = join(import.meta.dirname, "..");
const COMPONENTS = join(UI_ROOT, "src", "components");
const APP_IMPORT = /apps\/web|\b#\//;
const ROUTER_IMPORT = /@tanstack\/react-router|react-router|next\/navigation/;
const SHADCN_LOCAL_IMPORT = /^@workspace\/ui\/(components\/shadcn|lib|hooks)\//;
const IMPORT_SPECIFIER = /from "([^"]+)"/g;
const SOURCE_FILE = /\.(ts|tsx)$/;

function filesIn(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => SOURCE_FILE.test(file))
    .map((file) => join(dir, file));
}

function allUiSourceFiles(): string[] {
  return filesIn(join(UI_ROOT, "src"));
}

function sourceOf(file: string): string {
  return readFileSync(file, "utf8");
}

test("brand/ is exactly the rebrand set (shell, logo, auth page)", () => {
  expect(readdirSync(join(COMPONENTS, "brand")).sort()).toEqual([
    "auth-page.tsx",
    "logo-monochrome.tsx",
    "shell.tsx",
  ]);
});

test("data-table/ is exactly the generic table composites", () => {
  expect(readdirSync(join(COMPONENTS, "data-table")).sort()).toEqual([
    "data-table-features.ts",
    "data-table.tsx",
    "resource-table.tsx",
    "sortable-header.tsx",
    "table-filter-toolbar.tsx",
    "table-filter-types.ts",
  ]);
});

test("brand/ and data-table/ import nothing from the app", () => {
  for (const dir of ["brand", "data-table"]) {
    for (const file of filesIn(join(COMPONENTS, dir))) {
      expect(sourceOf(file), file).not.toMatch(APP_IMPORT);
    }
  }
});

test("nothing under packages/ui imports a router", () => {
  for (const file of allUiSourceFiles()) {
    expect(sourceOf(file), file).not.toMatch(ROUTER_IMPORT);
  }
});

test("shadcn/ stays registry stock: only shadcn/lib/hooks subpaths or packages", () => {
  const shadcnDir = join(COMPONENTS, "shadcn");
  for (const file of filesIn(shadcnDir)) {
    for (const match of sourceOf(file).matchAll(IMPORT_SPECIFIER)) {
      const specifier = match[1];
      if (specifier?.startsWith("@workspace/")) {
        expect(specifier, file).toMatch(SHADCN_LOCAL_IMPORT);
      }
    }
  }
});
