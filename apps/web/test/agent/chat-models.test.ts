import {
  DEFAULT_WORKERS_AI_MODEL,
  gateChatAttachments,
  getCompactionLimit,
  type OrgChatModelCapabilities,
  type OrgInferenceEnv,
  resolveOrgChatCapabilities,
  resolveOrgChatModel,
} from "@workspace/agent/inference";
import { describe, expect, it } from "vitest";

/**
 * The provider decision is pure. Workers AI returns a model-id string and
 * does not touch the network. The other branches construct an SDK client
 * and still do not call it.
 */

const NEEDS_GATEWAY_KEY = /AI_GATEWAY_API_KEY/;
const NEEDS_OPENAI_COMPATIBLE_URL = /OPENAI_COMPATIBLE_BASE_URL/;
const NEEDS_OPENAI_COMPATIBLE_KEY = /OPENAI_COMPATIBLE_API_KEY/;
const NEEDS_ORG_CHAT_MODEL = /ORG_CHAT_MODEL/;
const NEEDS_CONTEXT_WINDOW = /ORG_CHAT_CONTEXT_WINDOW/;
const ONLY_ACCEPTS_TEXT = /only accepts text/i;
const ONLY_IMAGE = /only image/i;

function env(overrides: OrgInferenceEnv = {}): OrgInferenceEnv {
  return overrides;
}

describe("resolveOrgChatModel", () => {
  it("defaults to the Workers AI model string with no env set", () => {
    const resolved = resolveOrgChatModel(env());
    expect(resolved.provider).toBe("workers-ai");
    expect(resolved.model).toBe(DEFAULT_WORKERS_AI_MODEL);
    expect(resolved.contextWindow).toBe(128_000);
    expect(resolved.capabilities).toEqual({
      provider: "workers-ai",
      entryId: DEFAULT_WORKERS_AI_MODEL,
      inputModalities: ["text"],
      supportsImageInput: false,
    });
  });

  it("falls back to workers-ai for an unknown ORG_CHAT_PROVIDER", () => {
    const resolved = resolveOrgChatModel(
      env({ ORG_CHAT_PROVIDER: "nonsense" })
    );
    expect(resolved.provider).toBe("workers-ai");
    expect(resolved.model).toBe(DEFAULT_WORKERS_AI_MODEL);
  });

  it("treats empty-string env values as unset", () => {
    const resolved = resolveOrgChatModel(
      env({
        ORG_CHAT_PROVIDER: "",
        ORG_CHAT_MODEL: "",
        ORG_CHAT_IMAGE_INPUT: "",
        ORG_CHAT_CONTEXT_WINDOW: "",
        AI_GATEWAY_API_KEY: "",
        OPENAI_COMPATIBLE_BASE_URL: "",
        OPENAI_COMPATIBLE_API_KEY: "",
      })
    );
    expect(resolved.provider).toBe("workers-ai");
    expect(resolved.model).toBe(DEFAULT_WORKERS_AI_MODEL);
    expect(resolved.capabilities.supportsImageInput).toBe(false);
  });

  it("honors a Workers AI model override and stays a string", () => {
    const resolved = resolveOrgChatModel(
      env({
        ORG_CHAT_PROVIDER: "workers-ai",
        ORG_CHAT_MODEL: "@cf/meta/llama-3.1-8b-instruct",
      })
    );
    expect(resolved.model).toBe("@cf/meta/llama-3.1-8b-instruct");
    expect(resolved.capabilities.entryId).toBe(
      "@cf/meta/llama-3.1-8b-instruct"
    );
  });

  it("reads the context window and image flag", () => {
    const resolved = resolveOrgChatModel(
      env({
        ORG_CHAT_CONTEXT_WINDOW: "1000000",
        ORG_CHAT_IMAGE_INPUT: "true",
      })
    );
    expect(resolved.contextWindow).toBe(1_000_000);
    expect(resolved.capabilities.supportsImageInput).toBe(true);
    expect(resolved.capabilities.inputModalities).toEqual(["text", "image"]);
    expect(getCompactionLimit(resolved.contextWindow)).toBe(750_000);
  });

  it("rejects a non-integer context window", () => {
    expect(() =>
      resolveOrgChatModel(env({ ORG_CHAT_CONTEXT_WINDOW: "lots" }))
    ).toThrow(NEEDS_CONTEXT_WINDOW);
  });

  it("requires a model and a gateway key for vercel-ai-gateway", () => {
    expect(() =>
      resolveOrgChatModel(env({ ORG_CHAT_PROVIDER: "vercel-ai-gateway" }))
    ).toThrow(NEEDS_ORG_CHAT_MODEL);
    expect(() =>
      resolveOrgChatModel(
        env({
          ORG_CHAT_PROVIDER: "vercel-ai-gateway",
          ORG_CHAT_MODEL: "openai/gpt-5.4",
        })
      )
    ).toThrow(NEEDS_GATEWAY_KEY);
    const resolved = resolveOrgChatModel(
      env({
        ORG_CHAT_PROVIDER: "vercel-ai-gateway",
        ORG_CHAT_MODEL: "openai/gpt-5.4",
        AI_GATEWAY_API_KEY: "gw-key",
      })
    );
    expect(resolved.provider).toBe("vercel-ai-gateway");
    expect(typeof resolved.model).toBe("object");
    expect(resolved.capabilities.entryId).toBe("openai/gpt-5.4");
  });

  it("requires url, key, and model for openai-compatible", () => {
    expect(() =>
      resolveOrgChatModel(env({ ORG_CHAT_PROVIDER: "openai-compatible" }))
    ).toThrow(NEEDS_ORG_CHAT_MODEL);
    expect(() =>
      resolveOrgChatModel(
        env({
          ORG_CHAT_PROVIDER: "openai-compatible",
          ORG_CHAT_MODEL: "e2e-fake-model",
        })
      )
    ).toThrow(NEEDS_OPENAI_COMPATIBLE_URL);
    expect(() =>
      resolveOrgChatModel(
        env({
          ORG_CHAT_PROVIDER: "openai-compatible",
          ORG_CHAT_MODEL: "e2e-fake-model",
          OPENAI_COMPATIBLE_BASE_URL: "http://127.0.0.1:8799/v1",
        })
      )
    ).toThrow(NEEDS_OPENAI_COMPATIBLE_KEY);
    const resolved = resolveOrgChatModel(
      env({
        ORG_CHAT_PROVIDER: "openai-compatible",
        ORG_CHAT_MODEL: "e2e-fake-model",
        OPENAI_COMPATIBLE_BASE_URL: "http://127.0.0.1:8799/v1",
        OPENAI_COMPATIBLE_API_KEY: "e2e",
        ORG_CHAT_IMAGE_INPUT: "1",
      })
    );
    expect(resolved.provider).toBe("openai-compatible");
    expect(typeof resolved.model).toBe("object");
    expect(resolved.capabilities.supportsImageInput).toBe(true);
  });
});

describe("resolveOrgChatCapabilities", () => {
  it("does not require keys, and leaves entryId empty until a model is set", () => {
    expect(
      resolveOrgChatCapabilities(
        env({ ORG_CHAT_PROVIDER: "openai-compatible" })
      )
    ).toMatchObject({
      provider: "openai-compatible",
      entryId: "",
      supportsImageInput: false,
    });
    expect(resolveOrgChatCapabilities(env())).toMatchObject({
      provider: "workers-ai",
      entryId: DEFAULT_WORKERS_AI_MODEL,
    });
  });
});

describe("getCompactionLimit", () => {
  it("is 75% of the window", () => {
    expect(getCompactionLimit(1_000_000)).toBe(750_000);
    expect(getCompactionLimit(128_000)).toBe(96_000);
  });
});

describe("gateChatAttachments", () => {
  const textOnly: OrgChatModelCapabilities = {
    provider: "workers-ai",
    entryId: DEFAULT_WORKERS_AI_MODEL,
    inputModalities: ["text"],
    supportsImageInput: false,
  };
  const vision: OrgChatModelCapabilities = {
    provider: "openai-compatible",
    entryId: "e2e-fake-model",
    inputModalities: ["text", "image"],
    supportsImageInput: true,
  };

  it("allows text-only parts on every model", () => {
    expect(gateChatAttachments([{ type: "text" }], textOnly)).toEqual({
      ok: true,
    });
    expect(gateChatAttachments([{ type: "text" }], vision)).toEqual({
      ok: true,
    });
  });

  it("rejects any file part on text-only models before the API call", () => {
    const result = gateChatAttachments(
      [{ type: "text" }, { type: "file", mediaType: "image/png" }],
      textOnly
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected rejection");
    }
    expect(result.reason).toMatch(ONLY_ACCEPTS_TEXT);
  });

  it("rejects non-image files on vision-capable models", () => {
    const result = gateChatAttachments(
      [{ type: "file", mediaType: "text/plain" }],
      vision
    );
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected rejection");
    }
    expect(result.reason).toMatch(ONLY_IMAGE);
  });

  it("allows image file parts on vision-capable models", () => {
    expect(
      gateChatAttachments(
        [{ type: "text" }, { type: "file", mediaType: "image/png" }],
        vision
      )
    ).toEqual({ ok: true });
  });
});
