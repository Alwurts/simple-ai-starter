import { convertFileListToFileUIParts, type FileUIPart } from "ai";

/**
 * Image `File`s as sendable attachment parts (data URLs, the format the AI
 * SDK sends over the wire — never `blob:` preview URLs). The SDK helper reads
 * a real `FileList`; our attachment list is a mutable array, so hop through a
 * `DataTransfer` to hand it one.
 */
export function filePartsFromFiles(files: File[]): Promise<FileUIPart[]> {
  if (files.length === 0) {
    return Promise.resolve([]);
  }
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return convertFileListToFileUIParts(transfer.files);
}
