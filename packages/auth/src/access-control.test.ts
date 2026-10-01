import { describe, expect, it } from "vitest";
import { type Action, can } from "./access-control";

const OPERATOR_ACTIONS: Action[] = ["catalog:write"];
const ADMIN_ACTIONS: Action[] = [
  ...OPERATOR_ACTIONS,
  "member:manage",
  "org:settings",
];
const OWNER_ACTIONS: Action[] = [
  ...ADMIN_ACTIONS,
  "member:invite-owner",
  "org:delete",
];

describe("can() — statement authorization", () => {
  it("operator (member) may write catalog but nothing sensitive", () => {
    for (const action of OPERATOR_ACTIONS) {
      expect(can(action, { role: "member" })).toBe(true);
    }
    const adminPlus: Action[] = [
      "member:manage",
      "org:settings",
      "member:invite-owner",
      "org:delete",
    ];
    for (const action of adminPlus) {
      expect(can(action, { role: "member" })).toBe(false);
    }
  });

  it("admin may manage members and settings but not delete the org or invite owners", () => {
    for (const action of ADMIN_ACTIONS) {
      expect(can(action, { role: "admin" })).toBe(true);
    }
    for (const action of ["member:invite-owner", "org:delete"] as Action[]) {
      expect(can(action, { role: "admin" })).toBe(false);
    }
  });

  it("owner may perform every action", () => {
    for (const action of OWNER_ACTIONS) {
      expect(can(action, { role: "owner" })).toBe(true);
    }
  });

  it("denies a missing or unknown role", () => {
    for (const action of OWNER_ACTIONS) {
      expect(can(action, { role: null })).toBe(false);
      expect(can(action, { role: undefined })).toBe(false);
      expect(can(action, { role: "viewer" })).toBe(false);
    }
  });
});
