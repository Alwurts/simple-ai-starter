import { describe, expect, it } from "vitest";
import { ROLE_LABELS, roleLabel } from "./role-label";

describe("role labels", () => {
  it("labels the three stored roles in plain English", () => {
    expect(ROLE_LABELS.member).toBe("Member");
    expect(ROLE_LABELS.admin).toBe("Admin");
    expect(ROLE_LABELS.owner).toBe("Owner");
  });

  it("renders unknown better-auth role strings as-is", () => {
    expect(roleLabel("developer")).toBe("developer");
    expect(roleLabel("member")).toBe("Member");
  });
});
