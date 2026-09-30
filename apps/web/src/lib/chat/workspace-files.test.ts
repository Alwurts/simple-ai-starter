import { describe, expect, it } from "vitest";
import { isTextFile } from "./workspace-files";

describe("isTextFile", () => {
  it("accepts text mimes and known text extensions", () => {
    expect(isTextFile({ mimeType: "text/plain", name: "notes.txt" })).toBe(
      true
    );
    expect(isTextFile({ mimeType: null, name: "run.tsx" })).toBe(true);
    expect(
      isTextFile({ mimeType: "application/json", name: "data.json" })
    ).toBe(true);
  });

  it("rejects known binary mimes and unknown extensions", () => {
    expect(isTextFile({ mimeType: "image/png", name: "logo.png" })).toBe(false);
    expect(
      isTextFile({ mimeType: "application/octet-stream", name: "blob.bin" })
    ).toBe(false);
    expect(isTextFile({ mimeType: null, name: "archive.weird" })).toBe(false);
    expect(isTextFile({ mimeType: null, name: "noext" })).toBe(false);
  });
});
