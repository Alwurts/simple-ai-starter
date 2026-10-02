import { DomainError } from "@workspace/core/errors";

/** Throw when a getter misses. The AI SDK surfaces the message as a tool error. */
export function requireFound<T>(
  data: T | null | undefined,
  detail = "Not found"
): T {
  if (data === null || data === undefined) {
    throw new DomainError(detail, "not_found");
  }
  return data;
}
