"use client";

import { toast } from "@workspace/ui/components/shadcn/sonner";
import type { FileUIPart } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { filePartsFromFiles } from "@/lib/chat/attachments";

/**
 * Per-file cap for image attachments. Data URLs are ~4/3 the file size and
 * ride in every later request frame, so unbounded photos would bloat the
 * whole transcript.
 */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** An attachment held for preview; converted to a data-URL part on submit. */
export interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

/**
 * Attachment tray for the chat composer. Previews are `blob:` URLs for
 * display only; `takeParts()` converts the files to data-URL parts via the
 * AI SDK helper and revokes the previews only after the data is captured —
 * on a read failure the attachments are kept so the user can retry.
 */
export function useChatAttachments(options: { supportsImages: boolean }) {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [converting, setConverting] = useState(false);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  // biome-ignore lint/plugin/no-use-effect: revoke blob previews if the tray unmounts first
  useEffect(
    () => () => {
      for (const attachment of attachmentsRef.current) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    },
    []
  );

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      if (!options.supportsImages) {
        toast.error(
          "This chat model only accepts text. Remove attachments and try again."
        );
        return;
      }
      const incoming = Array.from(list);
      const images = incoming.filter((file) => file.type.startsWith("image/"));
      if (incoming.length > 0 && images.length === 0) {
        toast.error(
          "Only image attachments are supported. Remove other file types and try again."
        );
        return;
      }
      if (images.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
        toast.error(
          `Images must be under ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB.`
        );
        return;
      }
      setAttachments((prev) => [
        ...prev,
        ...images.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    },
    [options.supportsImages]
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const found = prev.find((attachment) => attachment.id === id);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== id);
    });
  }, []);

  /**
   * Convert the attached files into sendable parts. Null means a read
   * failed (toast shown) and the attachments are kept for a retry; on
   * success the tray is emptied and the preview URLs revoked — only after
   * the parts hold the data.
   */
  const takeParts = useCallback(async (): Promise<FileUIPart[] | null> => {
    if (attachments.length === 0) {
      return [];
    }
    setConverting(true);
    try {
      const parts = await filePartsFromFiles(
        attachments.map((attachment) => attachment.file)
      );
      setAttachments((prev) => {
        for (const attachment of prev) {
          URL.revokeObjectURL(attachment.previewUrl);
        }
        return [];
      });
      return parts;
    } catch (error) {
      console.error("[ChatComposer] failed to read attachments", error);
      toast.error("Couldn't read the attachments. Please try again.");
      return null;
    } finally {
      setConverting(false);
    }
  }, [attachments]);

  return { addFiles, attachments, converting, removeAttachment, takeParts };
}
