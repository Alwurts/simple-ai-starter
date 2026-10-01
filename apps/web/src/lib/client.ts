import { hc } from "hono/client";
import type { AppType } from "../api";

export const client = hc<AppType>("/api");

/**
 * Message from a failed API response's one error shape
 * (`{ error: { code, message, issues? } }`), for toasts; `fallback` when the
 * body isn't the error shape. Accepts the typed Hono client's responses.
 */
export async function apiErrorMessage(
  res: { json: () => Promise<unknown> },
  fallback: string
): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? fallback;
  } catch {
    return fallback;
  }
}
