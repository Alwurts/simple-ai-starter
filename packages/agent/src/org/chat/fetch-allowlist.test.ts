import { describe, expect, it } from "vitest";
import {
  fetchAllowlistForHosts,
  fetchToolsForEnv,
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

describe("fetchToolsForEnv", () => {
  it("registers no tool when FETCH_ALLOWED_HOSTS is unset or empty", () => {
    expect(fetchToolsForEnv(undefined)).toEqual({});
    expect(fetchToolsForEnv("")).toEqual({});
    expect(fetchToolsForEnv(" , ")).toEqual({});
  });

  it("registers exactly fetch_url for one allowlisted host", () => {
    const tools = fetchToolsForEnv("example.com");
    expect(Object.keys(tools)).toEqual(["fetch_url"]);
    // Read-only GET, no binding targets: the generic public tool only.
    const tool = tools.fetch_url as { description?: string };
    expect(tool.description).toContain("read-only GET");
  });
});
