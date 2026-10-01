// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { FileUIPart } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ATTACHMENT_BYTES,
  useChatAttachments,
} from "./use-chat-attachments";

// The SDK conversion needs a real `FileList` (jsdom has no `DataTransfer`
// constructor and no `URL.createObjectURL`), and the read must be gatable so
// the tests can pin the convert-before-revoke ordering. jsdom's real
// `File`/`FileReader` handle the rest.
class FakeFileList extends Array<File> {}

class FakeDataTransfer {
  private readonly added: File[] = [];
  items = {
    add: (file: File) => {
      this.added.push(file);
    },
  };
  get files() {
    const list = new FakeFileList();
    list.push(...this.added);
    return list;
  }
}

type ReadGate = "resolve" | "reject" | "hold";
let readGate: ReadGate = "resolve";
let releaseRead: (() => void) | null = null;

class GatedFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readAsDataURL(file: File) {
    queueMicrotask(() => {
      const result = `data:${file.type};base64,${btoa(file.name)}`;
      if (readGate === "reject") {
        this.onerror?.(new Error("read failed"));
        return;
      }
      if (readGate === "hold") {
        releaseRead = () => this.onload?.({ target: { result } });
        return;
      }
      this.onload?.({ target: { result } });
    });
  }
}

const createObjectURL = vi.fn(() => "blob:preview");
const revokeObjectURL = vi.fn();

const DATA_URL_PREFIX = /^data:image\/png;base64,/;

function imageFile(name: string, size: number): File {
  return new File([new Uint8Array(size)], name, { type: "image/png" });
}

function renderTray() {
  return renderHook(() => useChatAttachments({ supportsImages: true }));
}

beforeEach(() => {
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  vi.stubGlobal("FileList", FakeFileList);
  vi.stubGlobal("FileReader", GatedFileReader);
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
});

afterEach(() => {
  readGate = "resolve";
  releaseRead = null;
  createObjectURL.mockClear();
  revokeObjectURL.mockClear();
  vi.unstubAllGlobals();
});

describe("useChatAttachments", () => {
  it("rejects files over the per-file byte cap without keeping them", () => {
    const { result } = renderTray();

    act(() => {
      result.current.addFiles([
        imageFile("big.png", MAX_ATTACHMENT_BYTES + 1),
        imageFile("ok.png", 10),
      ]);
    });

    expect(result.current.attachments).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("revokes preview URLs only after the conversion captured the data", async () => {
    readGate = "hold";
    const { result } = renderTray();

    act(() => {
      result.current.addFiles([imageFile("chart.png", 10)]);
    });
    expect(result.current.attachments).toHaveLength(1);

    const outcome: { parts: FileUIPart[] | null } = { parts: null };
    await act(async () => {
      const pending = result.current.takeParts();
      // The read is held open: no data yet, so the preview must survive.
      await waitFor(() => {
        expect(releaseRead).not.toBeNull();
      });
      expect(revokeObjectURL).not.toHaveBeenCalled();
      releaseRead?.();
      outcome.parts = await pending;
    });

    expect(outcome.parts).not.toBeNull();
    expect(outcome.parts?.[0]?.url).toMatch(DATA_URL_PREFIX);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.attachments).toHaveLength(0);
    });
  });

  it("keeps the attachments when the read fails, so the send can be retried", async () => {
    readGate = "reject";
    const { result } = renderTray();

    act(() => {
      result.current.addFiles([imageFile("chart.png", 10)]);
    });

    const outcome: { parts: FileUIPart[] | null } = { parts: null };
    await act(async () => {
      outcome.parts = await result.current.takeParts();
    });

    expect(outcome.parts).toBeNull();
    expect(result.current.attachments).toHaveLength(1);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });
});
