import { describe, expect, it } from "vitest";
import {
  isNotFoundError,
  isOrgDataQueryKey,
  retryUnlessNotFound,
} from "./query";

describe("retryUnlessNotFound", () => {
  it("does not retry not-found errors", () => {
    expect(retryUnlessNotFound(0, new Error("Product not found"))).toBe(false);
    expect(retryUnlessNotFound(0, new Error("Entity not found"))).toBe(false);
  });

  it("retries other errors twice", () => {
    const err = new Error("Failed to load product");
    expect(retryUnlessNotFound(0, err)).toBe(true);
    expect(retryUnlessNotFound(1, err)).toBe(true);
    expect(retryUnlessNotFound(2, err)).toBe(false);
  });
});

describe("isNotFoundError", () => {
  it("matches not-found messages only", () => {
    expect(isNotFoundError(new Error("Document not found"))).toBe(true);
    expect(isNotFoundError(new Error("boom"))).toBe(false);
    expect(isNotFoundError("not found")).toBe(false);
  });
});

describe("isOrgDataQueryKey", () => {
  it("matches org-scoped keys", () => {
    expect(isOrgDataQueryKey(["org-1", "products", "list", {}])).toBe(true);
    expect(isOrgDataQueryKey(["org-1", "workspace", "dir", "/"])).toBe(true);
    expect(isOrgDataQueryKey(["org-1", "chat", "capabilities"])).toBe(true);
    expect(isOrgDataQueryKey(["org-1", "chats", "search", "kettle"])).toBe(
      true
    );
  });

  it("does not match user-scoped or malformed keys", () => {
    expect(isOrgDataQueryKey(["invitation", "inv-1"])).toBe(false);
    expect(isOrgDataQueryKey(["org-1"])).toBe(false);
    expect(isOrgDataQueryKey([{}, "products"])).toBe(false);
  });
});
