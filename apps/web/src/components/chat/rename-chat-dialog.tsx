"use client";

import { Button } from "@workspace/ui/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/shadcn/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/shadcn/field";
import { Input } from "@workspace/ui/components/shadcn/input";
import { type FormEvent, useState } from "react";

/**
 * Rename a chat from its sidebar row menu. Seeded from the chat's title on
 * every open; Save stays disabled while the title is empty or unchanged.
 */
export function RenameChatDialog({
  chat,
  open,
  onOpenChange,
  onRename,
}: {
  chat: { id: string; title: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (chatId: string, title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(chat.title);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const trimmed = title.trim();
  const canSave = Boolean(trimmed) && trimmed !== chat.title && !isSubmitting;

  // Re-seed on every open (React's adjust-state-during-render pattern) so a
  // rename followed by a cancel can't leak the old draft into the next open.
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    setTitle(chat.title);
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    setIsSubmitting(true);
    try {
      await onRename(chat.id, trimmed);
      onOpenChange(false);
    } catch {
      // OrgConnection already toasted the failure; stay open for a retry.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>
            The title also tells the palette search what to match.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field>
            <FieldLabel htmlFor="chat-title">Title</FieldLabel>
            <Input
              autoComplete="off"
              id="chat-title"
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </Field>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button">
              Cancel
            </Button>
            <Button disabled={!canSave} type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
