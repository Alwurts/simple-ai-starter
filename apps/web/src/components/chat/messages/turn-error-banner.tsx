"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import { AlertCircleIcon, RotateCcwIcon, XIcon } from "lucide-react";

/**
 * A failed turn this client started — a send or regenerate, including its
 * tool-approval continuations. The AI SDK surfaces those as `error` +
 * `status: "error"` instead of rejecting. Errors in server-driven
 * continuations — codemode approve/reject auto-continues, another tab's
 * turn, resume/recovery — never reach the hook's `error` and are not shown
 * anywhere; only the partial reply persists (Think `onChatError`,
 * `@cloudflare/think` docs › lifecycle-hooks). Retry re-runs the turn via
 * the hook's `regenerate`; dismiss clears the hook's error state.
 */
export function TurnErrorBanner({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
      data-slot="chat-turn-error"
      role="alert"
    >
      <AlertCircleIcon
        aria-hidden
        className="size-4 shrink-0 text-destructive"
      />
      <p className="min-w-0 flex-1 text-muted-foreground">
        Something went wrong on the last turn
        {message ? `: ${message}` : "."}
      </p>
      <Button onClick={onRetry} size="sm" type="button" variant="outline">
        <RotateCcwIcon />
        Retry
      </Button>
      <Button
        aria-label="Dismiss error"
        onClick={onDismiss}
        size="icon"
        type="button"
        variant="ghost"
      >
        <XIcon />
      </Button>
    </div>
  );
}
