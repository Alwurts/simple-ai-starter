"use client";

import { memo } from "react";

interface DisplayMemoryOutput {
  content?: string;
}

/** Card for the `display_memory` UI-echo tool. The payload is the org memory text. */
export const MemoryCard = memo(({ output }: { output?: unknown }) => {
  const content =
    typeof (output as DisplayMemoryOutput | undefined)?.content === "string"
      ? ((output as DisplayMemoryOutput).content?.trim() ?? "")
      : "";

  if (!content) {
    return (
      <p className="text-muted-foreground text-sm">Nothing remembered yet.</p>
    );
  }

  return (
    <div className="whitespace-pre-wrap rounded-md border bg-card px-3 py-2 text-sm">
      {content}
    </div>
  );
});

MemoryCard.displayName = "MemoryCard";
