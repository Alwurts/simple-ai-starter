const NOT_FOUND_MESSAGE = /not found/i;

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && NOT_FOUND_MESSAGE.test(error.message);
}

export function retryUnlessNotFound(
  failureCount: number,
  error: unknown
): boolean {
  if (isNotFoundError(error)) {
    return false;
  }
  return failureCount < 2;
}

/**
 * Org-scoped query keys start with the org id, then a feature root —
 * `[orgId, "products", …]`, `[orgId, "workspace", …]`, `[orgId, "chat", …]`,
 * `[orgId, "chats", …]`. Roots must match the factories in
 * `lib/<feature>/*-queries.ts` and `hooks/chat/use-workspace-queries.ts`.
 * (The invitation query is user-scoped, not org data.)
 */
export function isOrgDataQueryKey(queryKey: readonly unknown[]): boolean {
  return (
    typeof queryKey[0] === "string" &&
    queryKey.length > 1 &&
    ORG_DATA_ROOTS.has(queryKey[1] as string)
  );
}

const ORG_DATA_ROOTS = new Set(["products", "chat", "chats", "workspace"]);
