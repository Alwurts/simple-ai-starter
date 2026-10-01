import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Env-driven provider registry for org-agent inference.
 *
 * The org chat model is selected at runtime from environment variables so the
 * same codebase can route through Cloudflare Workers AI (the default) or any
 * OpenAI-compatible endpoint. Both providers are explicit HTTPS calls built
 * with `@ai-sdk/openai-compatible`, so everything runs under plain
 * `wrangler dev` — there is no `env.AI` binding.
 *
 * The decision (which provider, which model, which URL/key) is a pure function
 * (`resolveOrgChatModelConfig`) so it is directly testable; `resolveOrgChatModel`
 * layers the AI SDK client construction on top.
 */

/**
 * The env fields this module reads; optional so tests can pass partial envs.
 * Derived from the generated `Cloudflare.Env` (the secrets are declared in
 * `apps/web/wrangler.jsonc`), never restated by hand.
 */
export type OrgInferenceEnv = Partial<
  Pick<
    Cloudflare.Env,
    | "ORG_CHAT_PROVIDER"
    | "ORG_CHAT_MODEL"
    | "WORKERS_AI_API_TOKEN"
    | "CF_ACCOUNT_ID"
    | "OPENAI_COMPATIBLE_BASE_URL"
    | "OPENAI_COMPATIBLE_API_KEY"
  >
>;

export type OrgChatProvider = "workers-ai" | "openai-compatible";

/** Modalities a model accepts on user message content. `text` is always on. */
export type OrgChatInputModality = "text" | "image";

/**
 * Model-level input capabilities.
 *
 * Documented per catalog offering — not inferred from the SDK — because
 * OpenAI-compatible endpoints advertise the same wire shape while rejecting
 * non-text parts at runtime (`messages.content.type is invalid, allowed
 * values: ['text']`). The same provider can host both text-only and vision
 * models.
 */
export interface OrgChatModelCapabilities {
  provider: OrgChatProvider;
  /** Bare model id (e.g. `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). */
  entryId: string;
  inputModalities: readonly OrgChatInputModality[];
  supportsImageInput: boolean;
}

const PROVIDERS: readonly OrgChatProvider[] = [
  "workers-ai",
  "openai-compatible",
];

const DEFAULT_PROVIDER: OrgChatProvider = "workers-ai";

/**
 * Per-provider client construction: `providerName` labels the client, and the
 * base URL is resolved from env at resolve time (Workers AI derives it from
 * `CF_ACCOUNT_ID`; the generic provider reads `OPENAI_COMPATIBLE_BASE_URL`).
 */
interface ProviderBuild {
  providerName: string;
}

const PROVIDER_BUILD: Record<OrgChatProvider, ProviderBuild> = {
  "workers-ai": { providerName: "workersAi" },
  "openai-compatible": { providerName: "openaiCompatible" },
};

interface ModelOffering {
  provider: OrgChatProvider;
  /** Model id sent to the provider (e.g. `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). */
  entryId: string;
  /** Total context window (tokens) — drives the compaction budget. */
  contextWindow: number;
  /** User-message input modalities this model accepts. */
  inputModalities: readonly OrgChatInputModality[];
}

// Update this catalog when a new chat model is adopted. The first entry for a
// provider is its default when `ORG_CHAT_MODEL` is unset.
const MODEL_OFFERINGS: readonly ModelOffering[] = [
  {
    provider: "workers-ai",
    entryId: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    contextWindow: 128_000,
    inputModalities: ["text"],
  },
  // Capability row for the generic provider — NOT a default: it has no model
  // of its own, so `ORG_CHAT_MODEL` is required (see `selectOffering`).
  {
    provider: "openai-compatible",
    entryId: "z-ai/glm-5.3-flash",
    contextWindow: 1_000_000,
    inputModalities: ["text", "image"],
  },
];

// Conservative window for an unrecognized model id. Sized to the smallest
// mainstream window so the derived budget never overruns an unknown model.
const DEFAULT_CONTEXT_WINDOW = 128_000;

// Compact when input tokens reach this fraction of the model's window, leaving
// headroom for the response plus the next user turn before the hard ceiling.
const COMPACTION_FRACTION = 0.75;

/** The resolved construction plan for the org chat model — pure, no SDK calls. */
export interface OrgChatModelConfig {
  provider: OrgChatProvider;
  entryId: string;
  contextWindow: number;
  providerName: string;
  baseURL: string;
  apiKey?: string;
}

export interface ResolvedOrgChatModel {
  model: LanguageModel;
  contextWindow: number;
  provider: OrgChatProvider;
  capabilities: OrgChatModelCapabilities;
}

/** Minimal part shape used when gating attachments against provider capabilities. */
export interface ChatAttachmentPart {
  type: string;
  mediaType?: string;
}

export type AttachmentGateResult = { ok: true } | { ok: false; reason: string };

function capabilitiesFromOffering(
  offering: ModelOffering
): OrgChatModelCapabilities {
  return {
    provider: offering.provider,
    entryId: offering.entryId,
    inputModalities: offering.inputModalities,
    supportsImageInput: offering.inputModalities.includes("image"),
  };
}

/**
 * Resolve the active org-chat model's input capabilities from env.
 * Pure — same `selectProvider` + `selectOffering` path as model resolve.
 */
export function resolveOrgChatCapabilities(
  env: OrgInferenceEnv
): OrgChatModelCapabilities {
  const provider = selectProvider(env);
  const offering = selectOffering(provider, env);
  return capabilitiesFromOffering(offering);
}

/**
 * Gate file/image parts against provider capabilities before the model call.
 *
 * - Text-only providers: any `file` part is rejected.
 * - Image-capable providers: only `image/*` file parts are allowed; other
 *   media types (e.g. text files, PDFs) are rejected before the API call.
 */
export function gateChatAttachments(
  parts: readonly ChatAttachmentPart[],
  capabilities: OrgChatModelCapabilities
): AttachmentGateResult {
  const fileParts = parts.filter((part) => part.type === "file");
  if (fileParts.length === 0) {
    return { ok: true };
  }
  if (!capabilities.supportsImageInput) {
    return {
      ok: false,
      reason:
        "This chat model only accepts text. Remove attachments and try again, or switch to a vision-capable provider.",
    };
  }
  const unsupported = fileParts.find(
    (part) => !part.mediaType?.startsWith("image/")
  );
  if (unsupported) {
    return {
      ok: false,
      reason:
        "Only image attachments are supported for this chat model. Remove other file types and try again.",
    };
  }
  return { ok: true };
}

function isProvider(value: string): value is OrgChatProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

function selectProvider(env: OrgInferenceEnv): OrgChatProvider {
  const raw = env.ORG_CHAT_PROVIDER?.trim();
  return raw && isProvider(raw) ? raw : DEFAULT_PROVIDER;
}

// Providers whose model must be named explicitly — no catalog default.
const REQUIRES_EXPLICIT_MODEL: readonly OrgChatProvider[] = [
  "openai-compatible",
];

function selectOffering(
  provider: OrgChatProvider,
  env: OrgInferenceEnv
): ModelOffering {
  const override = env.ORG_CHAT_MODEL?.trim();
  if (override) {
    const known = MODEL_OFFERINGS.find(
      (o) => o.provider === provider && o.entryId === override
    );
    if (known) {
      return known;
    }
    // Allow an arbitrary model id for the provider with conservative defaults.
    return {
      provider,
      entryId: override,
      contextWindow: DEFAULT_CONTEXT_WINDOW,
      inputModalities: ["text"],
    };
  }
  if (REQUIRES_EXPLICIT_MODEL.includes(provider)) {
    throw new Error(
      `ORG_CHAT_PROVIDER="${provider}" requires ORG_CHAT_MODEL to be set.`
    );
  }
  const def = MODEL_OFFERINGS.find((o) => o.provider === provider);
  if (!def) {
    throw new Error(`No default model registered for provider "${provider}".`);
  }
  return def;
}

/** The env field carrying each provider's API key (also used in error messages). */
const KEY_FIELD: Record<OrgChatProvider, NonNullable<keyof OrgInferenceEnv>> = {
  "workers-ai": "WORKERS_AI_API_TOKEN",
  "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
};

function apiKeyFor(
  provider: OrgChatProvider,
  env: OrgInferenceEnv
): string | undefined {
  return env[KEY_FIELD[provider]];
}

function baseURLFor(provider: OrgChatProvider, env: OrgInferenceEnv): string {
  if (provider === "openai-compatible") {
    const direct = env.OPENAI_COMPATIBLE_BASE_URL?.trim();
    if (!direct) {
      throw new Error(
        `ORG_CHAT_PROVIDER="${provider}" requires OPENAI_COMPATIBLE_BASE_URL to be set.`
      );
    }
    return direct;
  }
  if (!env.CF_ACCOUNT_ID) {
    throw new Error(
      `ORG_CHAT_PROVIDER="${provider}" requires CF_ACCOUNT_ID to be set.`
    );
  }
  return `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/ai/v1`;
}

/**
 * Resolve the construction plan for the org chat model from env. Pure — makes no
 * SDK/network calls — so the provider/model/URL/key decisions are testable.
 */
export function resolveOrgChatModelConfig(
  env: OrgInferenceEnv
): OrgChatModelConfig {
  const provider = selectProvider(env);
  const offering = selectOffering(provider, env);
  const baseURL = baseURLFor(provider, env);
  const apiKey = apiKeyFor(provider, env);
  // Fail fast at resolve time with a clear message rather than a cryptic 401 on
  // the first inference — the registry's provider selection is explicit, so its
  // key must be present.
  if (!apiKey) {
    throw new Error(
      `ORG_CHAT_PROVIDER="${provider}" requires ${KEY_FIELD[provider]} to be set.`
    );
  }
  return {
    provider,
    entryId: offering.entryId,
    contextWindow: offering.contextWindow,
    providerName: PROVIDER_BUILD[provider].providerName,
    baseURL,
    apiKey,
  };
}

/** Exported for test coverage. */
export function buildOrgChatModel(config: OrgChatModelConfig): LanguageModel {
  return createOpenAICompatible({
    name: config.providerName,
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  }).chatModel(config.entryId);
}

/**
 * Resolve the org chat model from the runtime env. The result is constant for
 * a given env, so callers resolve it once (in `onStart`) rather than per turn.
 */
export function resolveOrgChatModel(env: Cloudflare.Env): ResolvedOrgChatModel {
  const config = resolveOrgChatModelConfig(env);
  return {
    model: buildOrgChatModel(config),
    contextWindow: config.contextWindow,
    provider: config.provider,
    capabilities: capabilitiesFromOffering(
      selectOffering(config.provider, env)
    ),
  };
}

/**
 * Token budget above which the chat history should be compacted, derived from
 * the resolved model's context window. Both the pre-turn heuristic backstop
 * (`compactAfter`) and the post-turn real-usage trigger use this so they agree.
 */
export function getCompactionLimit(contextWindow: number): number {
  return Math.floor(contextWindow * COMPACTION_FRACTION);
}

/**
 * Think's context-window overflow recovery config: the reactive
 * backstop compacts and retries a turn the provider rejected as too long;
 * the proactive guard compacts mid-turn once real step usage crosses ~90% of
 * the model's window. Both run the session's `onCompaction` function.
 */
export function orgChatContextOverflow(contextWindow: number) {
  return {
    reactive: true,
    proactive: { maxInputTokens: contextWindow },
  };
}
