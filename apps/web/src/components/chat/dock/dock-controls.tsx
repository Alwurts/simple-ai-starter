"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/shadcn/tooltip";
import { useIsMobile } from "@workspace/ui/hooks/use-mobile";
import { Maximize2Icon, Minimize2Icon, MinusIcon, XIcon } from "lucide-react";
import { useChatDock } from "@/components/chat/dock/dock-context";

export function ChatDockWindowControls() {
  const dock = useChatDock();
  const isMobile = useIsMobile();
  const fullscreen = dock.state.size === "fullscreen";

  return (
    <>
      {isMobile ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={fullscreen ? "Restore chat" : "Expand chat"}
                className="size-7 shrink-0"
                onClick={dock.toggleSize}
                size="icon"
                type="button"
                variant="ghost"
              />
            }
          >
            {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
          </TooltipTrigger>
          <TooltipContent>{fullscreen ? "Restore" : "Expand"}</TooltipContent>
        </Tooltip>
      )}
      {isMobile ? null : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Minimize chat"
                className="size-7 shrink-0"
                onClick={dock.minimize}
                size="icon"
                type="button"
                variant="ghost"
              />
            }
          >
            <MinusIcon />
          </TooltipTrigger>
          <TooltipContent>Minimize</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              aria-label="Close chat"
              className="size-7 shrink-0"
              onClick={dock.closeFocused}
              size="icon"
              type="button"
              variant="ghost"
            />
          }
        >
          <XIcon />
        </TooltipTrigger>
        <TooltipContent>Close</TooltipContent>
      </Tooltip>
    </>
  );
}
