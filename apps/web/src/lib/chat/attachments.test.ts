import { afterEach, describe, expect, it, vi } from "vitest";
import { filePartsFromFiles } from "./attachments";

// The AI SDK helper insists on a real `FileList` and reads files through
// `FileReader`; neither exists in the node test environment, so stand in
// minimal fakes with the same shape.
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

class FakeFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  readAsDataURL(file: File) {
    queueMicrotask(() => {
      this.onload?.({
        target: {
          result: `data:${file.type};base64,${btoa(file.name)}`,
        },
      });
    });
  }
}

function stubBrowserFileApis() {
  vi.stubGlobal("FileList", FakeFileList);
  vi.stubGlobal("DataTransfer", FakeDataTransfer);
  vi.stubGlobal("FileReader", FakeFileReader);
}

describe("filePartsFromFiles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts files to data-URL attachment parts", async () => {
    stubBrowserFileApis();
    const files = [
      new File(["fake-png-bytes"], "chart.png", { type: "image/png" }),
    ];
    const parts = await filePartsFromFiles(files);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({
      type: "file",
      filename: "chart.png",
      mediaType: "image/png",
    });
    expect(parts[0].url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("never sends blob: preview URLs", async () => {
    stubBrowserFileApis();
    const parts = await filePartsFromFiles([
      new File(["x"], "a.png", { type: "image/png" }),
    ]);
    for (const part of parts) {
      expect(part.url.startsWith("blob:")).toBe(false);
    }
  });

  it("maps an empty list to no parts without touching the DOM APIs", async () => {
    const parts = await filePartsFromFiles([]);
    expect(parts).toEqual([]);
  });
});
