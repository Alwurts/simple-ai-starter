import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway, type LanguageModel } from "ai";

/**
 * Three-branch model pick for the org agent. No catalog.
 *
 * - `workers-ai` (default): return the model id string. Think resolves a
 *   `@cf/...` id off the `AI` binding, and any other `provider/model` slug
 *   through Cloudflare AI Gateway. Local Workers AI is remote (`wrangler login`).
 * - `vercel-ai-gateway`: `createGateway` from `ai` (re-exports `@ai-sdk/gateway`),
 *   key `AI_GATEWAY_API_KEY`. `ORG_CHAT_MODEL` is required.
 * - `openai-compatible`: BYO endpoint (e2e fake model, OrcaRouter smoke).
 *   Base URL, key, and `ORG_CHAT_MODEL` are required.
 */

export type OrgInferenceEnv = Partial<
  Pick<
    Cloudflare.Env,
    | "ORG_CHAT_PROVIDER"
    | "ORG_CHAT_MODEL"
    | "ORG_CHAT_IMAGE_INPUT"
    | "ORG_CHAT_CONTEXT_WINDOW"
    | "AI_GATEWAY_API_KEY"
    | "OPENAI_COMPATIBLE_BASE_URL"
    | "OPENAI_COMPATIBLE_API_KEY"
  >
>;

export type OrgChatProvider =
  | "workers-ai"
  | "vercel-ai-gateway"
  | "openai-compatible";

export type OrgChatInputModality = "text" | "image";

export interface OrgChatModelCapabilities {
  provider: OrgChatProvider;
  /** Model id sent to the provider, or the Workers AI string Think resolves. */
  entryId: string;
  inputModalities: readonly OrgChatInputModality[];
  supportsImageInput: boolean;
}

/** What `getModel()` returns. A string is only the Workers AI branch. */
export type OrgChatModel = LanguageModel | string;

export interface ResolvedOrgChatModel {
  model: OrgChatModel;
  contextWindow: number;
  provider: OrgChatProvider;
  capabilities: OrgChatModelCapabilities;
}

export interface ChatAttachmentPart {
  type: string;
  mediaType?: string;
}

export type AttachmentGateResult = { ok: true } | { ok: false; reason: string };

const PROVIDERS: readonly OrgChatProvider[] = [
  "workers-ai",
  "vercel-ai-gateway",
  "openai-compatible",
];

const DEFAULT_PROVIDER: OrgChatProvider = "workers-ai";

/** Workers AI default when `ORG_CHAT_MODEL` is unset. */
export const DEFAULT_WORKERS_AI_MODEL =
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const DEFAULT_CONTEXT_WINDOW = 128_000;

const COMPACTION_FRACTION = 0.75;

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function isProvider(value: string): value is OrgChatProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function selectProvider(env: OrgInferenceEnv): OrgChatProvider {
  const raw = trimmed(env.ORG_CHAT_PROVIDER);
  return raw && isProvider(raw) ? raw : DEFAULT_PROVIDER;
}

function imageInputEnabled(env: OrgInferenceEnv): boolean {
  const raw = trimmed(env.ORG_CHAT_IMAGE_INPUT)?.toLowerCase();
  return raw === "1" || raw === "true";
}

function contextWindowFor(env: OrgInferenceEnv): number {
  const raw = trimmed(env.ORG_CHAT_CONTEXT_WINDOW);
  if (!raw) {
    return DEFAULT_CONTEXT_WINDOW;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `ORG_CHAT_CONTEXT_WINDOW="${raw}" must be a positive integer.`
    );
  }
  return parsed;
}

function modelIdFor(provider: OrgChatProvider, env: OrgInferenceEnv): string {
  const override = trimmed(env.ORG_CHAT_MODEL);
  if (override) {
    return override;
  }
  if (provider === "workers-ai") {
    return DEFAULT_WORKERS_AI_MODEL;
  }
  throw new Error(
    `ORG_CHAT_PROVIDER="${provider}" requires ORG_CHAT_MODEL to be set.`
  );
}

function requireEnv(
  provider: OrgChatProvider,
  name: string,
  value: string | undefined
): string {
  const text = trimmed(value);
  if (!text) {
    throw new Error(
      `ORG_CHAT_PROVIDER="${provider}" requires ${name} to be set.`
    );
  }
  return text;
}

function capabilitiesFor(
  provider: OrgChatProvider,
  entryId: string,
  env: OrgInferenceEnv
): OrgChatModelCapabilities {
  const supportsImageInput = imageInputEnabled(env);
  return {
    provider,
    entryId,
    inputModalities: supportsImageInput ? ["text", "image"] : ["text"],
    supportsImageInput,
  };
}

function buildModel(
  provider: OrgChatProvider,
  modelId: string,
  env: OrgInferenceEnv
): OrgChatModel {
  if (provider === "workers-ai") {
    return modelId;
  }
  if (provider === "vercel-ai-gateway") {
    const apiKey = requireEnv(
      provider,
      "AI_GATEWAY_API_KEY",
      env.AI_GATEWAY_API_KEY
    );
    return createGateway({ apiKey })(modelId);
  }
  const baseURL = requireEnv(
    provider,
    "OPENAI_COMPATIBLE_BASE_URL",
    env.OPENAI_COMPATIBLE_BASE_URL
  );
  const apiKey = requireEnv(
    provider,
    "OPENAI_COMPATIBLE_API_KEY",
    env.OPENAI_COMPATIBLE_API_KEY
  );
  return createOpenAICompatible({
    name: "openaiCompatible",
    baseURL,
    apiKey,
  }).chatModel(modelId);
}

/**
 * Resolve the org chat model from env. Workers AI returns a model-id string
 * (Think builds the client off the `AI` binding). The other two branches
 * return an AI SDK model. Callers resolve once and memoize.
 */
export function resolveOrgChatModel(
  env: OrgInferenceEnv
): ResolvedOrgChatModel {
  const provider = selectProvider(env);
  const entryId = modelIdFor(provider, env);
  return {
    model: buildModel(provider, entryId, env),
    contextWindow: contextWindowFor(env),
    provider,
    capabilities: capabilitiesFor(provider, entryId, env),
  };
}

/**
 * Input capabilities for the composer. Does not construct a client and does
 * not require provider keys. A provider that still needs `ORG_CHAT_MODEL`
 * reports `entryId: ""` until it is set, so the capabilities route stays up.
 */
export function resolveOrgChatCapabilities(
  env: OrgInferenceEnv
): OrgChatModelCapabilities {
  const provider = selectProvider(env);
  const entryId =
    trimmed(env.ORG_CHAT_MODEL) ??
    (provider === "workers-ai" ? DEFAULT_WORKERS_AI_MODEL : "");
  return capabilitiesFor(provider, entryId, env);
}

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

export function getCompactionLimit(contextWindow: number): number {
  return Math.floor(contextWindow * COMPACTION_FRACTION);
}

export function orgChatContextOverflow(contextWindow: number) {
  return {
    reactive: true,
    proactive: { maxInputTokens: contextWindow },
  };
}
