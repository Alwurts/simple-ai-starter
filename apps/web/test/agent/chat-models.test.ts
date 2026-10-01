import {
  buildOrgChatModel,
  gateChatAttachments,
  getCompactionLimit,
  type OrgChatModelCapabilities,
  type OrgInferenceEnv,
  resolveOrgChatCapabilities,
  resolveOrgChatModel,
  resolveOrgChatModelConfig,
} from "@workspace/agent/inference";
import { describe, expect, it } from "vitest";

/**
 * The provider decision (which provider, model, base URL, key) is a pure
 * function, so we assert it directly without touching the network or an SDK
 * client.
 *
 * Model input capabilities + attachment gating are also pure.
 */

const NEEDS_ACCOUNT_ID = /CF_ACCOUNT_ID/;
const NEEDS_WORKERS_AI_TOKEN = /WORKERS_AI_API_TOKEN/;
const NEEDS_OPENAI_COMPATIBLE_URL = /OPENAI_COMPATIBLE_BASE_URL/;
const NEEDS_OPENAI_COMPATIBLE_KEY = /OPENAI_COMPATIBLE_API_KEY/;
const NEEDS_ORG_CHAT_MODEL = /ORG_CHAT_MODEL/;
const ONLY_ACCEPTS_TEXT = /only accepts text/i;
const ONLY_IMAGE = /only image/i;

function env(overrides: OrgInferenceEnv = {}): OrgInferenceEnv {
  return overrides;
}

describe("resolveOrgChatModelConfig", () => {
  it("AC-1: defaults to workers-ai / llama-3.3-70b with no env set", () => {
    const config = resolveOrgChatModelConfig(
      env({
        CF_ACCOUNT_ID: "acct123",
        WORKERS_AI_API_TOKEN: "cf-token",
      })
    );
    expect(config.provider).toBe("workers-ai");
    expect(config.entryId).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    expect(config.contextWindow).toBe(128_000);
    expect(config.baseURL).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1"
    );
    expect(config.apiKey).toBe("cf-token");
  });

  it("falls back to the default provider for an unknown ORG_CHAT_PROVIDER", () => {
    const config = resolveOrgChatModelConfig(
      env({
        ORG_CHAT_PROVIDER: "nonsense",
        CF_ACCOUNT_ID: "acct123",
        WORKERS_AI_API_TOKEN: "cf-token",
      })
    );
    expect(config.provider).toBe("workers-ai");
  });

  it("treats empty-string env values as unset (a copied .dev.vars.example)", () => {
    // `cp .dev.vars.example .dev.vars` leaves every key present with empty
    // values: selection falls back to the default provider, and resolving a
    // model fails with the same clear errors as absent keys.
    const allEmpty = {
      ORG_CHAT_PROVIDER: "",
      ORG_CHAT_MODEL: "",
      CF_ACCOUNT_ID: "",
      WORKERS_AI_API_TOKEN: "",
      OPENAI_COMPATIBLE_BASE_URL: "",
      OPENAI_COMPATIBLE_API_KEY: "",
    };
    expect(resolveOrgChatCapabilities(env(allEmpty))).toMatchObject({
      provider: "workers-ai",
    });
    expect(() => resolveOrgChatModelConfig(env(allEmpty))).toThrow(
      NEEDS_ACCOUNT_ID
    );
    expect(() =>
      resolveOrgChatModelConfig(env({ CF_ACCOUNT_ID: "acct123" }))
    ).toThrow(NEEDS_WORKERS_AI_TOKEN);
    expect(() =>
      resolveOrgChatModelConfig(env({ ORG_CHAT_PROVIDER: "openai-compatible" }))
    ).toThrow(NEEDS_ORG_CHAT_MODEL);
  });

  it("AC-2: resolves a Workers AI model via the account-scoped openai endpoint (no binding)", () => {
    const config = resolveOrgChatModelConfig(
      env({
        ORG_CHAT_PROVIDER: "workers-ai",
        CF_ACCOUNT_ID: "acct123",
        WORKERS_AI_API_TOKEN: "cf-token",
      })
    );
    expect(config.providerName).toBe("workersAi");
    expect(config.baseURL).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/ai/v1"
    );
    expect(config.apiKey).toBe("cf-token");
    expect(config.entryId).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });

  it("honours an ORG_CHAT_MODEL override within the provider", () => {
    const config = resolveOrgChatModelConfig(
      env({
        ORG_CHAT_PROVIDER: "workers-ai",
        CF_ACCOUNT_ID: "acct123",
        WORKERS_AI_API_TOKEN: "cf-token",
        ORG_CHAT_MODEL: "@cf/meta/llama-3.1-8b-instruct",
      })
    );
    expect(config.entryId).toBe("@cf/meta/llama-3.1-8b-instruct");
  });

  it("AC-2: workers-ai without an account id or without a token is a clear error", () => {
    expect(() =>
      resolveOrgChatModelConfig(env({ ORG_CHAT_PROVIDER: "workers-ai" }))
    ).toThrow(NEEDS_ACCOUNT_ID);
    expect(() =>
      resolveOrgChatModelConfig(
        env({ ORG_CHAT_PROVIDER: "workers-ai", CF_ACCOUNT_ID: "acct123" })
      )
    ).toThrow(NEEDS_WORKERS_AI_TOKEN);
  });
});

describe("openai-compatible provider (generic OpenAI-compatible endpoint)", () => {
  const baseEnv: OrgInferenceEnv = {
    ORG_CHAT_PROVIDER: "openai-compatible",
    OPENAI_COMPATIBLE_BASE_URL: "https://api.orcarouter.ai/v1",
    OPENAI_COMPATIBLE_API_KEY: "ok",
    ORG_CHAT_MODEL: "z-ai/glm-5.3-flash",
  };

  it("AC-3: resolves base URL + key + model from env, calling the origin directly", () => {
    const config = resolveOrgChatModelConfig(env(baseEnv));
    expect(config.provider).toBe("openai-compatible");
    expect(config.providerName).toBe("openaiCompatible");
    expect(config.baseURL).toBe("https://api.orcarouter.ai/v1");
    expect(config.apiKey).toBe("ok");
    expect(config.entryId).toBe("z-ai/glm-5.3-flash");
    expect(config.contextWindow).toBe(1_000_000);
  });

  it("fails when the base URL, the key or the model is missing", () => {
    expect(() =>
      resolveOrgChatModelConfig(
        env({ ...baseEnv, OPENAI_COMPATIBLE_BASE_URL: undefined })
      )
    ).toThrow(NEEDS_OPENAI_COMPATIBLE_URL);
    expect(() =>
      resolveOrgChatModelConfig(
        env({ ...baseEnv, OPENAI_COMPATIBLE_API_KEY: undefined })
      )
    ).toThrow(NEEDS_OPENAI_COMPATIBLE_KEY);
    expect(() =>
      resolveOrgChatModelConfig(env({ ...baseEnv, ORG_CHAT_MODEL: undefined }))
    ).toThrow(NEEDS_ORG_CHAT_MODEL);
  });

  it("constructs a model", () => {
    const model = buildOrgChatModel(resolveOrgChatModelConfig(env(baseEnv)));
    expect(model).toBeDefined();
  });

  it("the catalog entry reports image input on", () => {
    expect(resolveOrgChatCapabilities(env(baseEnv))).toEqual({
      provider: "openai-compatible",
      entryId: "z-ai/glm-5.3-flash",
      inputModalities: ["text", "image"],
      supportsImageInput: true,
    });
  });

  it("unknown model ids fall back to the conservative defaults", () => {
    expect(
      resolveOrgChatCapabilities(
        env({ ...baseEnv, ORG_CHAT_MODEL: "vendor/other-model" })
      )
    ).toEqual({
      provider: "openai-compatible",
      entryId: "vendor/other-model",
      inputModalities: ["text"],
      supportsImageInput: false,
    });
  });
});

describe("buildOrgChatModel", () => {
  it("constructs a workers-ai model", () => {
    const model = buildOrgChatModel(
      resolveOrgChatModelConfig(
        env({
          ORG_CHAT_PROVIDER: "workers-ai",
          CF_ACCOUNT_ID: "acct123",
          WORKERS_AI_API_TOKEN: "cf-token",
        })
      )
    );
    expect(model).toBeDefined();
  });
});

describe("resolveOrgChatModel", () => {
  it("resolves from Cloudflare.Env without a cast", () => {
    const resolved = resolveOrgChatModel({
      ORG_CHAT_PROVIDER: "openai-compatible",
      OPENAI_COMPATIBLE_BASE_URL: "https://api.example.com/v1",
      OPENAI_COMPATIBLE_API_KEY: "k",
      ORG_CHAT_MODEL: "z-ai/glm-5.3-flash",
    } as Cloudflare.Env);
    expect(resolved.contextWindow).toBe(1_000_000);
    expect(resolved.model).toBeDefined();
    expect(resolved.provider).toBe("openai-compatible");
    expect(resolved.capabilities.supportsImageInput).toBe(true);
  });
});

describe("getCompactionLimit", () => {
  it("is 75% of the context window", () => {
    expect(getCompactionLimit(1_000_000)).toBe(750_000);
    expect(getCompactionLimit(128_000)).toBe(96_000);
  });
});

describe("org chat model capabilities", () => {
  it("resolves modalities from the active catalog offering per provider", () => {
    expect(
      resolveOrgChatCapabilities(
        env({
          ORG_CHAT_PROVIDER: "workers-ai",
          CF_ACCOUNT_ID: "acct123",
          WORKERS_AI_API_TOKEN: "cf-token",
        })
      )
    ).toEqual({
      provider: "workers-ai",
      entryId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      inputModalities: ["text"],
      supportsImageInput: false,
    });
  });

  it("defaults unknown ORG_CHAT_MODEL overrides to text-only", () => {
    expect(
      resolveOrgChatCapabilities(
        env({
          ORG_CHAT_PROVIDER: "workers-ai",
          CF_ACCOUNT_ID: "acct123",
          WORKERS_AI_API_TOKEN: "cf-token",
          ORG_CHAT_MODEL: "@cf/meta/llama-3.1-8b-instruct",
        })
      )
    ).toEqual({
      provider: "workers-ai",
      entryId: "@cf/meta/llama-3.1-8b-instruct",
      inputModalities: ["text"],
      supportsImageInput: false,
    });
  });
});

describe("gateChatAttachments", () => {
  const textOnly: OrgChatModelCapabilities = {
    provider: "workers-ai",
    entryId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    inputModalities: ["text"],
    supportsImageInput: false,
  };
  const vision: OrgChatModelCapabilities = {
    provider: "openai-compatible",
    entryId: "z-ai/glm-5.3-flash",
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
