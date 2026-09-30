"use client";

import {
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderIcon,
  ShellHeaderSidebarTrigger,
  ShellHeaderTitle,
} from "@workspace/ui/components/brand/shell";
import { Button } from "@workspace/ui/components/shadcn/button";
import { BotIcon, PanelRightIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Chat page top bar: sidebar trigger, bot icon, title, menu, panel toggle. */
export function ChatHeader({
  title,
  menu,
  panelOpen,
  onTogglePanel,
}: {
  title: string;
  menu: ReactNode;
  panelOpen: boolean;
  onTogglePanel?: () => void;
}) {
  return (
    <ShellHeader className="px-3" data-slot="full-screen-chat-header">
      <ShellHeaderSidebarTrigger className="-ml-1" />
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <ShellHeaderIcon>
          <BotIcon />
        </ShellHeaderIcon>
        <ShellHeaderTitle>{title}</ShellHeaderTitle>
        {menu}
      </div>
      {panelOpen || !onTogglePanel ? null : (
        <ShellHeaderActions>
          <Button
            className="size-7 shrink-0"
            onClick={onTogglePanel}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelRightIcon />
            <span className="sr-only">Open side panel</span>
          </Button>
        </ShellHeaderActions>
      )}
    </ShellHeader>
  );
}
