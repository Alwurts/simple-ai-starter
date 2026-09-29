"use client";

import { ShellHeaderSidebarTrigger as ShellHeaderSidebarTriggerBase } from "@workspace/ui/components/brand/shell";

export function ShellHeaderSidebarTrigger({
  className,
}: {
  className?: string;
}) {
  return (
    <ShellHeaderSidebarTriggerBase
      className={className}
      toggleLabel="Toggle Sidebar"
    />
  );
}
