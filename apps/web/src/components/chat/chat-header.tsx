"use client";

import {
  ShellHeader,
  ShellHeaderActions,
  ShellHeaderIcon,
  ShellHeaderSidebarTrigger,
  ShellHeaderTitle,
} from "@workspace/ui/components/brand/shell";
import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/shadcn/tooltip";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { ArrowLeftIcon, BotIcon, PanelRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useChatDock } from "@/components/chat/dock/dock-context";

export function ChatHeader({
  title,
  menu,
  panelOpen,
  onTogglePanel,
  windowControls,
}: {
  title: string;
  menu: ReactNode;
  panelOpen: boolean;
  onTogglePanel?: () => void;
  windowControls?: ReactNode;
}) {
  const isMobile = useIsMobile();
  const dock = useChatDock();
  const showFiles = Boolean(onTogglePanel) && !panelOpen;
  const leaveChat = () => {
    if (dock.state.focus?.kind === "draft") {
      dock.closeFocused();
      return;
    }
    dock.minimize();
  };
  return (
    <ShellHeader className="flex-nowrap px-3" data-slot="chat-dock-header">
      <ShellHeaderSidebarTrigger className="-ml-1" />
      {isMobile ? (
        <Button
          aria-label="Back"
          className="size-7 shrink-0"
          onClick={leaveChat}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon />
        </Button>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
        <ShellHeaderIcon>
          <BotIcon />
        </ShellHeaderIcon>
        <ShellHeaderTitle>{title}</ShellHeaderTitle>
        {menu}
      </div>
      {showFiles || windowControls ? (
        <ShellHeaderActions>
          {showFiles ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    className="size-7 shrink-0"
                    onClick={onTogglePanel}
                    size="icon"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <PanelRightIcon />
                <span className="sr-only">Files</span>
              </TooltipTrigger>
              <TooltipContent>Files</TooltipContent>
            </Tooltip>
          ) : null}
          {windowControls}
        </ShellHeaderActions>
      ) : null}
    </ShellHeader>
  );
}
