import { DomainError } from "@workspace/core/errors";
import { describe, expect, it } from "vitest";
import { requireFound } from "./tool-result";

describe("requireFound", () => {
  it("returns data when present", () => {
    expect(requireFound({ id: "p1" })).toEqual({ id: "p1" });
  });

  it("throws DomainError not_found when null or undefined", () => {
    expect(() => requireFound(null)).toThrow(
      new DomainError("Not found", "not_found")
    );
    expect(() => requireFound(undefined)).toThrow(
      new DomainError("Not found", "not_found")
    );
    expect(() => requireFound(null, "Product not found: x")).toThrow(
      new DomainError("Product not found: x", "not_found")
    );
  });
});
