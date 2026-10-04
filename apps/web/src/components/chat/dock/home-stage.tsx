"use client";

import {
  ShellContent,
  ShellHeader,
  ShellHeaderSidebarTrigger,
  ShellHeaderTitle,
  ShellPage,
} from "@workspace/ui/components/brand/shell";

/** The page under the dock. Chat never replaces this inset. */
export function HomeStage() {
  return (
    <ShellPage>
      <ShellHeader>
        <ShellHeaderSidebarTrigger className="-ml-1" />
        <ShellHeaderTitle>Home</ShellHeaderTitle>
      </ShellHeader>
      <ShellContent>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <h2 className="font-semibold text-2xl tracking-tight">Starter</h2>
          <p className="max-w-sm text-muted-foreground text-sm">
            Open a chat from the list. It stays over this page.
          </p>
        </div>
      </ShellContent>
    </ShellPage>
  );
}
