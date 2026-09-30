"use client";

import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@workspace/ui/components/shadcn/attachment";
import {
  ChatInput,
  ChatInputEditor,
  type ChatInputHandle,
  ChatInputSubmitButton,
} from "@workspace/ui/components/shadcn/chat-input";
import {
  InputGroupAddon,
  InputGroupButton,
} from "@workspace/ui/components/shadcn/input-group";
import { toast } from "@workspace/ui/components/shadcn/sonner";
import type { ChatStatus, FileUIPart } from "ai";
import { PaperclipIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useChatCapabilities } from "@/hooks/chat/use-chat-capabilities";
import { filePartsFromFiles } from "@/lib/chat/attachments";

export interface PromptMessage {
  text: string;
  files: FileUIPart[];
}

/** An attachment held for preview; converted to a data-URL part on submit. */
interface ChatAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

function ChatInputInner({
  disabled,
  onStop,
  onSubmit,
  placeholder,
  status,
}: {
  disabled: boolean;
  onStop?: () => void;
  onSubmit: (message: PromptMessage) => void | Promise<void>;
  placeholder: string;
  status: ChatStatus;
}) {
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [converting, setConverting] = useState(false);
  const inputRef = useRef<ChatInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: capabilities } = useChatCapabilities();
  const supportsImageInput = capabilities?.supportsImageInput === true;

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const attachment of prev) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
      return [];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const found = prev.find((attachment) => attachment.id === id);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== id);
    });
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      if (!supportsImageInput) {
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
      setAttachments((prev) => [
        ...prev,
        ...images.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ]);
    },
    [supportsImageInput]
  );

  const submit = useCallback(
    async (text: string, clear: () => void): Promise<void> => {
      if (!(text || attachments.length > 0)) {
        return;
      }
      if (attachments.length > 0 && !supportsImageInput) {
        toast.error(
          "This chat model only accepts text. Remove attachments and try again."
        );
        return;
      }
      let files: PromptMessage["files"] = [];
      if (attachments.length > 0) {
        setConverting(true);
        try {
          files = await filePartsFromFiles(
            attachments.map((attachment) => attachment.file)
          );
        } catch (error) {
          console.error("[ChatComposer] failed to read attachments", error);
          toast.error("Couldn't read the attachments. Please try again.");
          return;
        } finally {
          setConverting(false);
        }
      }
      // The parts now carry the image data (data URLs), so the preview
      // object URLs can go.
      clearAttachments();
      clear();
      await onSubmit({ text, files });
    },
    [attachments, clearAttachments, onSubmit, supportsImageInput]
  );

  return (
    <div className="w-full">
      <input
        accept={supportsImageInput ? "image/*" : undefined}
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.currentTarget.files?.length) {
            addFiles(event.currentTarget.files);
          }
          event.currentTarget.value = "";
        }}
        ref={fileInputRef}
        type="file"
      />
      <ChatInput
        className="rounded-2xl"
        disabled={disabled || converting}
        onStop={onStop}
        onSubmit={(parsed, { clear }) => {
          const trimmed = String(parsed.text ?? "").trim();
          return submit(trimmed, clear);
        }}
        ref={inputRef}
        status={status}
      >
        {attachments.length > 0 ? (
          <InputGroupAddon align="block-start" className="pb-0">
            <AttachmentGroup>
              {attachments.map((attachment) => (
                <Attachment key={attachment.id} size="xs" state="done">
                  <AttachmentMedia variant="image">
                    <img
                      alt={attachment.file.name}
                      height={24}
                      src={attachment.previewUrl}
                      width={24}
                    />
                  </AttachmentMedia>
                  <AttachmentContent>
                    <AttachmentTitle>{attachment.file.name}</AttachmentTitle>
                  </AttachmentContent>
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label={`Remove ${attachment.file.name}`}
                      onClick={() => removeAttachment(attachment.id)}
                    >
                      <XIcon />
                    </AttachmentAction>
                  </AttachmentActions>
                </Attachment>
              ))}
            </AttachmentGroup>
          </InputGroupAddon>
        ) : null}
        <ChatInputEditor placeholder={placeholder} />
        <InputGroupAddon align="block-end" className="pt-1">
          {supportsImageInput ? (
            <InputGroupButton
              aria-label="Add images"
              onClick={() => fileInputRef.current?.click()}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <PaperclipIcon />
            </InputGroupButton>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <ChatInputSubmitButton />
          </div>
        </InputGroupAddon>
      </ChatInput>
    </div>
  );
}

export function ChatComposer({
  disabled = false,
  onStop,
  onSubmit,
  placeholder = "Ask anything...",
  status,
}: {
  disabled?: boolean;
  onStop?: () => void;
  onSubmit: (message: PromptMessage) => void | Promise<void>;
  placeholder?: string;
  status: ChatStatus;
}) {
  return (
    <div className="relative bottom-0 z-10 w-full bg-background pt-2">
      <div className="mx-auto w-full p-2 @[500px]:px-4 @[500px]:pb-4 md:max-w-3xl @[500px]:md:pb-6">
        <ChatInputInner
          disabled={disabled}
          onStop={onStop}
          onSubmit={onSubmit}
          placeholder={placeholder}
          status={status}
        />
      </div>
    </div>
  );
}
