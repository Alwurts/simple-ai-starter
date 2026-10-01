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
import { useCallback, useRef } from "react";
import { useChatAttachments } from "@/hooks/chat/use-chat-attachments";
import { useChatCapabilities } from "@/hooks/chat/use-chat-capabilities";

export interface PromptMessage {
  text: string;
  files: FileUIPart[];
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
  const inputRef = useRef<ChatInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: capabilities } = useChatCapabilities();
  const supportsImageInput = capabilities?.supportsImageInput === true;
  const { addFiles, attachments, converting, removeAttachment, takeParts } =
    useChatAttachments({ supportsImages: supportsImageInput });

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
      // Null = a read failed and the attachments were kept for a retry.
      const files = await takeParts();
      if (files === null) {
        return;
      }
      clear();
      await onSubmit({ text, files });
    },
    [attachments.length, onSubmit, supportsImageInput, takeParts]
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
