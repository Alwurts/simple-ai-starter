import { describe, expect, it } from "vitest";
import { firstSendPlan } from "./first-send";

describe("firstSendPlan", () => {
  it("does not create a chat for an empty composer", () => {
    expect(firstSendPlan({ text: "   ", files: [] })).toBeNull();
  });

  it("builds the outgoing message and a title for the first send", () => {
    const plan = firstSendPlan({
      text: "  list my products ",
      files: [],
    });
    expect(plan?.title).toBe("list my products");
    expect(plan?.outgoing).toEqual({
      role: "user",
      parts: [{ type: "text", text: "list my products" }],
    });
  });

  it("keeps image parts and titles an attachment-only send from the fallback text", () => {
    const file = {
      type: "file" as const,
      mediaType: "image/png",
      url: "blob:img",
    };
    const plan = firstSendPlan({ text: "", files: [file] });
    expect(plan?.title).toBe("Sent with attachments");
    expect(plan?.outgoing.parts).toEqual([
      { type: "text", text: "Sent with attachments" },
      file,
    ]);
  });
});
