import { describe, expect, it } from "vitest";
import {
  fetchAllowlistForHosts,
  parseFetchAllowedHosts,
} from "./fetch-allowlist";

describe("parseFetchAllowedHosts", () => {
  it("returns [] for unset or empty values — the fetch tool must not exist", () => {
    expect(parseFetchAllowedHosts(undefined)).toEqual([]);
    expect(parseFetchAllowedHosts("")).toEqual([]);
    expect(parseFetchAllowedHosts("   ")).toEqual([]);
    expect(parseFetchAllowedHosts(" , ")).toEqual([]);
  });

  it("splits comma-separated hostnames and trims whitespace", () => {
    expect(parseFetchAllowedHosts("example.com, docs.example.com")).toEqual([
      "example.com",
      "docs.example.com",
    ]);
  });
});

describe("fetchAllowlistForHosts", () => {
  it("grants each host as a bare origin (origin + every subpath)", () => {
    expect(fetchAllowlistForHosts(["example.com"])).toEqual([
      "https://example.com",
    ]);
  });
});
