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
import { FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useChatCapabilities } from "@/hooks/use-chat-capabilities";

export interface PromptMessage {
  text: string;
  files: FileUIPart[];
}

type ChatInputFile = FileUIPart & { id: string };

function filePartsFromList(fileList: FileList | File[]): ChatInputFile[] {
  return Array.from(fileList).map((file) => ({
    id: crypto.randomUUID(),
    type: "file" as const,
    filename: file.name,
    mediaType: file.type,
    url: URL.createObjectURL(file),
  }));
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
  const [files, setFiles] = useState<ChatInputFile[]>([]);
  const inputRef = useRef<ChatInputHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: capabilities } = useChatCapabilities();
  const supportsImageInput = capabilities?.supportsImageInput === true;

  const clearFiles = useCallback(() => {
    setFiles((prev) => {
      for (const file of prev) {
        if (file.url) {
          URL.revokeObjectURL(file.url);
        }
      }
      return [];
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
      setFiles((prev) => [...prev, ...filePartsFromList(images)]);
    },
    [supportsImageInput]
  );

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const found = prev.find((file) => file.id === id);
      if (found?.url) {
        URL.revokeObjectURL(found.url);
      }
      return prev.filter((file) => file.id !== id);
    });
  }, []);

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
        disabled={disabled}
        onStop={onStop}
        onSubmit={(parsed, { clear }) => {
          const trimmed = String(parsed.text ?? "").trim();
          if (!(trimmed || files.length > 0)) {
            return;
          }
          if (files.length > 0 && !supportsImageInput) {
            toast.error(
              "This chat model only accepts text. Remove attachments and try again."
            );
            return;
          }
          const payload: PromptMessage = {
            text: trimmed,
            files: files.map(({ id: _id, ...file }) => file),
          };
          clearFiles();
          clear();
          Promise.resolve(onSubmit(payload)).catch(() => undefined);
        }}
        ref={inputRef}
        status={status}
      >
        {files.length > 0 ? (
          <InputGroupAddon align="block-start" className="pb-0">
            <AttachmentGroup>
              {files.map((file) => {
                const isImage = Boolean(
                  file.mediaType?.startsWith("image/") && file.url
                );
                return (
                  <Attachment key={file.id} size="xs" state="done">
                    <AttachmentMedia variant={isImage ? "image" : "icon"}>
                      {isImage ? (
                        <img
                          alt={file.filename ?? ""}
                          height={24}
                          src={file.url}
                          width={24}
                        />
                      ) : (
                        <FileIcon />
                      )}
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>
                        {file.filename ?? "Attachment"}
                      </AttachmentTitle>
                    </AttachmentContent>
                    <AttachmentActions>
                      <AttachmentAction
                        aria-label={`Remove ${file.filename ?? "attachment"}`}
                        onClick={() => removeFile(file.id)}
                      >
                        <XIcon />
                      </AttachmentAction>
                    </AttachmentActions>
                  </Attachment>
                );
              })}
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
